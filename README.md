# 🪔 Festival Advance Bolton — SAIL Employee Welfare System

A professional Node.js web application for managing Festival Advance applications as per SAIL Circular No. PER/E CI/1983 dated 22/09/2008.

## Policy Summary
- Advance Amount: **₹5,000/-** (enhanced from ₹3,000/-)
- Recovery: **10 monthly instalments of ₹500/-**
- Eligible: **Non-executive employees**
- Application Deadline: **2nd of the month**
- Finance Export: **By 5th of the month in Excel/CSV format**

---

## Quick Start

### Prerequisites
- Node.js v16 or higher
- npm v7 or higher

### Installation
```bash
# 1. Navigate to the project directory
cd festival-advance

# 2. Install dependencies
npm install

# 3. Start the server
node server.js

# 4. Open browser
http://localhost:3000
```

---

## Demo Credentials

| Role     | Staff No | Password | Access |
|----------|----------|----------|--------|
| Employee | EMP001   | pass123  | Apply, view own applications |
| Employee | EMP002   | pass123  | Apply, view own applications |
| HoD      | HOD001   | hod123   | Review & approve dept apps |
| Finance  | MGR001   | fin123   | Sanction & export CSV data |
| Admin    | ADMIN001 | admin123 | Change policy: amount, instalments, deadline |

## SSO — Oracle Cloud

The **"Sign in with SAIL SSO"** button redirects to **Oracle Cloud** (`cloud.oracle.com`).
To wire it to a real Oracle Identity Domain (IDCS), set these in `.env`:

```
ORACLE_IDCS_URL=https://idcs-xxxx.identity.oraclecloud.com
ORACLE_CLIENT_ID=your_client_id
ORACLE_CLIENT_SECRET=your_client_secret
ORACLE_REDIRECT_URI=http://localhost:3000/sso/callback
```

The authorization-code → token exchange happens **server-side only** — the
client secret never reaches the browser. Register `/sso/callback` as an allowed
redirect URI in your Oracle app.

## Admin — Policy Control

Log in as **ADMIN001 / admin123** to change:
- **Festival advance amount** (e.g. ₹5,000 → ₹7,000)
- **Number of recovery instalments** (monthly instalment auto-recalculates)
- **Application deadline** (the day of month employees must apply by)
- **Eligible category** and a master **open/close** switch

Changes apply to all *new* applications instantly; already-filed applications
keep their original terms.

---

## Workflow (as per circular)

```
Employee applies (by 2nd)
        ↓
HoD reviews & approves
        ↓
Finance sanctions
        ↓
Data exported as CSV (Dept Code, Staff No, Amount)
by 5th of the month
```

## CSV Export Format
The Finance export follows the exact format from the circular:
- Column 1: Department Code (Char-3)
- Column 2: Staff No (Char-6)  
- Column 3: Amount (Numeric-6)

---

## Features
- ✅ Role-based access: Employee / HoD / Finance
- ✅ Full validation (IFSC, bank account, deadline check)
- ✅ Application timeline/audit trail
- ✅ CSV export in correct format for Finance
- ✅ Recovery schedule display (10 × ₹500)
- ✅ Festival dropdown with major Indian festivals
- ✅ Professional, responsive UI
- ✅ Session-based auth (no client-side secrets)
- ✅ All API calls server-side only (architecture ready for JWT Bearer Token)

---

## Architecture Notes

### Security
- No API keys or secrets exposed to client browser
- All business logic on Node.js server
- Session-based authentication with express-session
- Helmet.js for security headers
- Input validation both client-side and server-side

### Production Readiness
Replace the in-memory `db` object in `server.js` with:
- MongoDB / PostgreSQL for persistence
- JWT Bearer Token user assertion for Fusion REST API integration
- Redis for session storage

### Fusion REST API Integration (for production)
```javascript
// In server.js — backend call pattern
const jwt = require('jsonwebtoken');
const token = jwt.sign({ sub: user.staffNo }, privateKey, { algorithm: 'RS256' });
const response = await fetch('https://your-fusion-host/hcmRestApi/resources/...', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

*Festival Advance Bolton — Developed as part of AI/LLM Vibe Coding Challenge*
*Prompt Engineering + Node.js + EJS + Vanilla CSS*
