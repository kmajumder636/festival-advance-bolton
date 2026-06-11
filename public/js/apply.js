const form = document.getElementById('applyForm');
const submitBtn = document.getElementById('submitBtn');

form?.addEventListener('submit', function(e) {
  const errors = [];

  const festival = document.getElementById('festival').value;
  const month = document.getElementById('month').value;
  const year = document.getElementById('year').value;
  const bankAccount = document.getElementById('bankAccount').value;
  const ifscCode = document.getElementById('ifscCode').value;
  const decl = document.getElementById('declCheck').checked;

  if (!festival) errors.push('Please select a festival.');
  if (!month) errors.push('Please select the month.');
  if (!year) errors.push('Please select the year.');
  if (!/^\d{9,18}$/.test(bankAccount)) errors.push('Bank account must be 9-18 digits.');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) errors.push('IFSC format: XXXX0XXXXXX');
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
