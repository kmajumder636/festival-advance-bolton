const form = document.getElementById('applyForm');
const submitBtn = document.getElementById('submitBtn');

// Toggle the manual bank fields when "use salary account" is checked
function toggleBankFields() {
  const useSalary = document.getElementById('useSalaryAccount');
  const bankFields = document.getElementById('bankFields');
  const acc = document.getElementById('bankAccount');
  const ifsc = document.getElementById('ifscCode');
  const accName = document.getElementById('accountName');
  const reqAcc = document.getElementById('reqAcc');
  const reqIfsc = document.getElementById('reqIfsc');
  const reqName = document.getElementById('reqName');
  if (!useSalary) return;

  if (useSalary.checked) {
    bankFields.style.display = 'none';
    acc.required = false; ifsc.required = false;
    acc.value = ''; ifsc.value = ''; if (accName) accName.value = '';
    if (reqAcc) reqAcc.style.display = 'none';
    if (reqIfsc) reqIfsc.style.display = 'none';
    if (reqName) reqName.style.display = 'none';
  } else {
    bankFields.style.display = '';
    acc.required = true; ifsc.required = true;
    if (reqAcc) reqAcc.style.display = '';
    if (reqIfsc) reqIfsc.style.display = '';
    if (reqName) reqName.style.display = '';
  }
}

form?.addEventListener('submit', function(e) {
  const errors = [];
  const useSalary = document.getElementById('useSalaryAccount');
  const usingSalary = useSalary && useSalary.checked;

  const festival = document.getElementById('festival').value;
  const month = document.getElementById('month').value;
  const year = document.getElementById('year').value;
  const decl = document.getElementById('declCheck').checked;

  if (!festival) errors.push('Please select a festival.');
  if (!month) errors.push('Please select the month.');
  if (!year) errors.push('Please select the year.');

  if (!usingSalary) {
    const accountName = document.getElementById('accountName').value.trim();
    const bankAccount = document.getElementById('bankAccount').value;
    const ifscCode = document.getElementById('ifscCode').value;
    if (accountName.length < 3) errors.push('Enter the name as per bank.');
    if (!/^\d{9,18}$/.test(bankAccount)) errors.push('Bank account must be 9-18 digits.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) errors.push('IFSC format: XXXX0XXXXXX');
  }
  if (!decl) errors.push('Please accept the declaration.');

  if (errors.length > 0) {
    e.preventDefault();
    alert('Please fix the following:\n\n' + errors.join('\n'));
    return;
  }

  submitBtn.textContent = 'Submitting…';
  submitBtn.disabled = true;
});

// IFSC uppercase enforcer
document.getElementById('ifscCode')?.addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

// Bank account number only
document.getElementById('bankAccount')?.addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '');
});
