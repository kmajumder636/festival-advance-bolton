require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store (replace with DB in production)
const db = {
  applications: [],
  users: [
    { staffNo: 'EMP001', name: 'Rajesh Kumar', dept: 'HRD', deptCode: 'HRD', role: 'employee', password: 'pass123', designation: 'Senior Officer', salaryAccount: '50100234567890', salaryIfsc: 'SBIN0001234' },
    { staffNo: 'EMP002', name: 'Priya Sharma', dept: 'FIN', deptCode: 'FIN', role: 'employee', password: 'pass123', designation: 'Officer', salaryAccount: '50100987654321', salaryIfsc: 'HDFC0000456' },
    { staffNo: 'HOD001', name: 'Shanta H Sinha', dept: 'HRD', deptCode: 'HRD', role: 'hod', password: 'hod123', designation: 'Head of Department' },
    { staffNo: 'MGR001', name: 'Finance Manager', dept: 'FIN', deptCode: 'FIN', role: 'finance', password: 'fin123', designation: 'Sr. Manager Finance-Pay' },
    { staffNo: 'ADMIN001', name: 'System Administrator', dept: 'IT', deptCode: 'ITD', role: 'admin', password: 'admin123', designation: 'Bolton Administrator' },
  ],
  festivals: ['Durga Puja', 'Diwali', 'Eid', 'Christmas', 'Holi', 'Dussehra', 'Navratri', 'Bhai Dooj']
};

// ─── Policy Settings (editable by Admin) ────────────────────────────────────
const settings = {
  amount: 5000,                 // Festival advance amount (₹)
  installments: 10,             // Number of recovery instalments
  applyDeadlineDay: 2,          // Employees must apply by this day of the month
  applicationsOpen: true,       // Master switch to open/close applications
  category: 'Non-Executive',    // Eligible category
  effectiveDate: '2008-10-01',  // Policy effective date
};
// Derived helper
function instalmentAmt() { return Math.round(settings.amount / settings.installments); }

// Oracle Cloud SSO configuration (Oracle IDCS / IAM Identity Domain)
const ORACLE = {
  // Set ORACLE_IDCS_URL to your tenant, e.g. https://idcs-xxxx.identity.oraclecloud.com
  baseUrl: process.env.ORACLE_IDCS_URL || '',
  clientId: process.env.ORACLE_CLIENT_ID || '',
  redirectUri: process.env.ORACLE_REDIRECT_URI || `http://localhost:${PORT}/sso/callback`,
  scope: process.env.ORACLE_SCOPE || 'openid profile email',
};

// Security & middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'festival-advance-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (role && req.session.user.role !== role && req.session.user.role !== 'finance') {
      if (role === 'hod' && req.session.user.role !== 'hod') return res.redirect('/dashboard');
    }
    next();
  };
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Home
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// Login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { staffNo, password } = req.body;
  const user = db.users.find(u => u.staffNo === staffNo && u.password === password);
  if (!user) return res.render('login', { error: 'Invalid Staff Number or Password.' });
  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ─── SSO (Single Sign-On) via Oracle Cloud ─────────────────────────────────
// The browser is redirected to Oracle Cloud (Oracle IDCS / IAM Identity Domain).
// Token exchange happens server-side only — no client_secret ever reaches the
// browser. If no tenant is configured, we redirect to cloud.oracle.com sign-in.

// Step 1: Redirect the user to Oracle Cloud for authentication
app.get('/sso/login', (req, res) => {
  const state = uuidv4();
  req.session.ssoState = state;

  // If a real Oracle IDCS tenant is configured, build the OIDC authorize URL
  if (ORACLE.baseUrl && ORACLE.clientId) {
    const authUrl = `${ORACLE.baseUrl}/oauth2/v1/authorize?` + new URLSearchParams({
      client_id: ORACLE.clientId,
      response_type: 'code',
      redirect_uri: ORACLE.redirectUri,
      scope: ORACLE.scope,
      state,
    }).toString();
    return res.redirect(authUrl);
  }

  // Otherwise redirect to Oracle Cloud sign-in page
  return res.redirect('https://cloud.oracle.com/sign-in');
});

// Step 2: Oracle redirects back here with an authorization code.
// The server exchanges it for tokens (server-side, using the client secret).
app.get('/sso/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!state || state !== req.session.ssoState) {
    return res.render('login', { error: 'SSO session expired or invalid state. Please sign in again.' });
  }
  if (!code) {
    return res.render('login', { error: 'No authorization code returned from Oracle Cloud.' });
  }

  // In production: exchange `code` for tokens at ORACLE.baseUrl/oauth2/v1/token
  // using HTTP Basic auth (client_id:client_secret) — entirely server-side.
  // Then decode the id_token, map the email/sub to a directory user, and sign in.
  //
  // Example (uncomment once a tenant + secret are configured):
  // const tokenResp = await fetch(`${ORACLE.baseUrl}/oauth2/v1/token`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': 'Basic ' + Buffer.from(`${ORACLE.clientId}:${process.env.ORACLE_CLIENT_SECRET}`).toString('base64'),
  //     'Content-Type': 'application/x-www-form-urlencoded'
  //   },
  //   body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: ORACLE.redirectUri })
  // });
  // const { id_token } = await tokenResp.json();
  // const claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());
  // const user = db.users.find(u => u.staffNo.toLowerCase() === claims.sub.toLowerCase());

  delete req.session.ssoState;
  return res.render('login', { error: 'Oracle Cloud SSO is not yet provisioned for this environment. Configure ORACLE_IDCS_URL, ORACLE_CLIENT_ID and ORACLE_CLIENT_SECRET, then register this callback URL in your IDCS app. For now, use standard staff-number login.' });
});

// Dashboard
app.get('/dashboard', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role === 'admin') return res.redirect('/admin');
  let applications = [];
  let stats = {};

  if (user.role === 'employee') {
    applications = db.applications.filter(a => a.staffNo === user.staffNo);
    stats = {
      total: applications.length,
      pending: applications.filter(a => a.status === 'Pending').length,
      approved: applications.filter(a => a.status === 'Approved').length,
      rejected: applications.filter(a => a.status === 'Rejected').length,
    };
  } else if (user.role === 'hod') {
    applications = db.applications.filter(a => a.deptCode === user.deptCode);
    stats = {
      total: applications.length,
      pending: applications.filter(a => a.status === 'Pending').length,
      approved: applications.filter(a => a.status === 'Approved').length,
      rejected: applications.filter(a => a.status === 'Rejected').length,
    };
  } else if (user.role === 'finance') {
    applications = db.applications.filter(a => a.status === 'HOD Approved');
    stats = {
      total: db.applications.length,
      pending: db.applications.filter(a => a.status === 'Pending').length,
      hodApproved: db.applications.filter(a => a.status === 'HOD Approved').length,
      approved: db.applications.filter(a => a.status === 'Approved').length,
    };
  }

  res.render('dashboard', { user, applications, stats, festivals: db.festivals, settings, instalmentAmt: instalmentAmt() });
});

// Apply for Festival Advance
app.get('/apply', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'employee') return res.redirect('/dashboard');
  const today = new Date();
  const isOpen = settings.applicationsOpen && today.getDate() <= settings.applyDeadlineDay;
  res.render('apply', { user, festivals: db.festivals, isOpen, error: null, success: null, settings, instalmentAmt: instalmentAmt() });
});

app.post('/apply', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'employee') return res.redirect('/dashboard');

  const { festival, month, year, bankAccount, ifscCode, accountName, declaration, useSalaryAccount } = req.body;
  const today = new Date();
  const errors = [];
  const usingSalary = (useSalaryAccount === 'on' || useSalaryAccount === 'yes' || useSalaryAccount === 'true');

  if (!festival) errors.push('Please select a festival.');
  if (!month) errors.push('Please select the month.');
  if (!year) errors.push('Please select the year.');

  // Bank validation only required when NOT using the salary account
  if (usingSalary) {
    if (!user.salaryAccount) errors.push('No salary account is on file for your record. Please enter bank details manually.');
  } else {
    if (!accountName || accountName.trim().length < 3) errors.push('Please enter the name as per bank (at least 3 characters).');
    if (!bankAccount || !/^\d{9,18}$/.test(bankAccount)) errors.push('Please enter a valid bank account number (9-18 digits).');
    if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) errors.push('Please enter a valid IFSC code.');
  }
  if (!declaration) errors.push('Please accept the declaration.');

  // Applications open check
  if (!settings.applicationsOpen) {
    errors.push('Festival Advance applications are currently closed by the administrator.');
  }

  // Check if already applied this month
  const existingApp = db.applications.find(a =>
    a.staffNo === user.staffNo && a.month === month && a.year === year
  );
  if (existingApp) errors.push('You have already applied for Festival Advance for this month.');

  // Check deadline (configurable by admin)
  if (today.getDate() > settings.applyDeadlineDay) {
    errors.push(`Applications must be submitted by the ${settings.applyDeadlineDay}${ordinal(settings.applyDeadlineDay)} of the month. Today is the ${today.getDate()}${ordinal(today.getDate())}. Please apply next month.`);
  }

  if (errors.length > 0) {
    return res.render('apply', {
      user, festivals: db.festivals, isOpen: true,
      error: errors.join(' | '), success: null, settings, instalmentAmt: instalmentAmt()
    });
  }

  const application = {
    id: uuidv4(),
    refNo: `FA/${user.deptCode}/${year}/${String(db.applications.length + 1).padStart(4, '0')}`,
    staffNo: user.staffNo,
    staffName: user.name,
    designation: user.designation,
    deptCode: user.deptCode,
    dept: user.dept,
    festival,
    month,
    year,
    amount: settings.amount,
    installments: settings.installments,
    installmentAmt: instalmentAmt(),
    accountType: usingSalary ? 'Salary Account' : 'Other Account',
    accountName: usingSalary ? user.name : (accountName || '').trim(),
    bankAccount: usingSalary
      ? user.salaryAccount.replace(/\d(?=\d{4})/g, '*')
      : bankAccount.replace(/\d(?=\d{4})/g, '*'),
    bankAccountRaw: usingSalary ? user.salaryAccount : bankAccount,
    ifscCode: usingSalary ? user.salaryIfsc : ifscCode,
    status: 'Pending',
    appliedOn: new Date().toLocaleDateString('en-IN'),
    appliedAt: new Date(),
    hodRemarks: '',
    financeRemarks: '',
    history: [{ action: 'Application Submitted', by: user.name, on: new Date().toLocaleString('en-IN'), status: 'Pending' }]
  };

  db.applications.push(application);
  res.render('apply', { user, festivals: db.festivals, isOpen: true, error: null, success: `Application submitted successfully! Reference No: ${application.refNo}`, settings, instalmentAmt: instalmentAmt() });
});

// Ordinal suffix helper (1st, 2nd, 3rd…)
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// View Application
app.get('/application/:id', requireLogin, (req, res) => {
  const app_data = db.applications.find(a => a.id === req.params.id);
  if (!app_data) return res.redirect('/dashboard');
  const user = req.session.user;
  // Access control
  if (user.role === 'employee' && app_data.staffNo !== user.staffNo) return res.redirect('/dashboard');
  if (user.role === 'hod' && app_data.deptCode !== user.deptCode) return res.redirect('/dashboard');
  res.render('application-detail', { user, app: app_data });
});

// Printable application form (for PDF submission to manager)
app.get('/application/:id/print', requireLogin, (req, res) => {
  const app_data = db.applications.find(a => a.id === req.params.id);
  if (!app_data) return res.redirect('/dashboard');
  const user = req.session.user;
  // Access control: owner employee, their HoD, finance, or admin
  if (user.role === 'employee' && app_data.staffNo !== user.staffNo) return res.redirect('/dashboard');
  if (user.role === 'hod' && app_data.deptCode !== user.deptCode) return res.redirect('/dashboard');
  res.render('print', { app: app_data, printedOn: new Date().toLocaleString('en-IN') });
});

// HOD Actions
app.post('/hod/action/:id', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'hod') return res.redirect('/dashboard');
  const application = db.applications.find(a => a.id === req.params.id);
  if (!application || application.deptCode !== user.deptCode) return res.redirect('/dashboard');

  const { action, remarks } = req.body;
  if (action === 'approve') {
    application.status = 'HOD Approved';
    application.hodRemarks = remarks || 'Approved';
  } else {
    application.status = 'Rejected';
    application.hodRemarks = remarks || 'Rejected by HoD';
  }
  application.history.push({
    action: action === 'approve' ? 'Approved by HoD' : 'Rejected by HoD',
    by: user.name,
    on: new Date().toLocaleString('en-IN'),
    status: application.status,
    remarks
  });
  res.redirect('/dashboard');
});

// Finance Actions
app.post('/finance/action/:id', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'finance') return res.redirect('/dashboard');
  const application = db.applications.find(a => a.id === req.params.id);
  if (!application) return res.redirect('/dashboard');

  const { action, remarks } = req.body;
  if (action === 'approve') {
    application.status = 'Approved';
    application.financeRemarks = remarks || 'Approved by Finance';
  } else {
    application.status = 'Rejected';
    application.financeRemarks = remarks || 'Rejected by Finance';
  }
  application.history.push({
    action: action === 'approve' ? 'Approved by Finance' : 'Rejected by Finance',
    by: user.name,
    on: new Date().toLocaleString('en-IN'),
    status: application.status,
    remarks
  });
  res.redirect('/dashboard');
});

// ─── Admin: Policy Settings ─────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') return res.redirect('/dashboard');
  next();
}

app.get('/admin', requireAdmin, (req, res) => {
  const stats = {
    total: db.applications.length,
    pending: db.applications.filter(a => a.status === 'Pending').length,
    approved: db.applications.filter(a => a.status === 'Approved').length,
    totalDisbursed: db.applications.filter(a => a.status === 'Approved').reduce((s, a) => s + a.amount, 0),
  };
  res.render('admin', {
    user: req.session.user, settings, instalmentAmt: instalmentAmt(),
    stats, saved: req.query.saved === '1', error: null
  });
});

app.post('/admin/settings', requireAdmin, (req, res) => {
  const { amount, installments, applyDeadlineDay, applicationsOpen, category } = req.body;

  const newAmount = parseInt(amount, 10);
  const newInst = parseInt(installments, 10);
  const newDay = parseInt(applyDeadlineDay, 10);
  const errors = [];

  if (isNaN(newAmount) || newAmount < 100 || newAmount > 999999) errors.push('Amount must be between ₹100 and ₹9,99,999.');
  if (isNaN(newInst) || newInst < 1 || newInst > 60) errors.push('Instalments must be between 1 and 60.');
  if (isNaN(newDay) || newDay < 1 || newDay > 28) errors.push('Deadline day must be between 1 and 28.');

  if (errors.length > 0) {
    const stats = {
      total: db.applications.length,
      pending: db.applications.filter(a => a.status === 'Pending').length,
      approved: db.applications.filter(a => a.status === 'Approved').length,
      totalDisbursed: db.applications.filter(a => a.status === 'Approved').reduce((s, a) => s + a.amount, 0),
    };
    return res.render('admin', { user: req.session.user, settings, instalmentAmt: instalmentAmt(), stats, saved: false, error: errors.join(' | ') });
  }

  settings.amount = newAmount;
  settings.installments = newInst;
  settings.applyDeadlineDay = newDay;
  settings.applicationsOpen = (applicationsOpen === 'on' || applicationsOpen === 'true');
  settings.category = category || settings.category;

  res.redirect('/admin?saved=1');
});

// Finance: Export Excel data (FLOPPY/CD simulation)
app.get('/finance/export', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'finance') return res.redirect('/dashboard');

  const approved = db.applications.filter(a => a.status === 'Approved');
  // CSV format matching the spec: DeptCode(Char-3), StaffNo(Char-6), Amount(Numeric-6)
  let csv = 'Department Code,Staff No,Amount\n';
  approved.forEach(a => {
    csv += `${a.deptCode.substring(0,3).padEnd(3)},${a.staffNo.substring(0,6).padEnd(6)},${String(a.amount).padStart(6,'0')}\n`;
  });

  res.setHeader('Content-Disposition', `attachment; filename="festival_advance_${new Date().toISOString().slice(0,10)}.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// API: Get all applications (for finance dashboard charts)
app.get('/api/stats', requireLogin, (req, res) => {
  const stats = {
    total: db.applications.length,
    byStatus: {
      pending: db.applications.filter(a => a.status === 'Pending').length,
      hodApproved: db.applications.filter(a => a.status === 'HOD Approved').length,
      approved: db.applications.filter(a => a.status === 'Approved').length,
      rejected: db.applications.filter(a => a.status === 'Rejected').length,
    },
    totalAmount: db.applications.filter(a => a.status === 'Approved').reduce((s, a) => s + a.amount, 0),
    festivals: db.festivals
  };
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`\n🎉 Festival Advance Bolton running at http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo Credentials:');
  console.log('  Employee : EMP001 / pass123');
  console.log('  Employee : EMP002 / pass123');
  console.log('  HoD      : HOD001 / hod123');
  console.log('  Finance  : MGR001 / fin123');
  console.log('  Admin    : ADMIN001 / admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
