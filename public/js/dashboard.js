function filterTable(val) {
  const rows = document.querySelectorAll('#appTable tbody tr');
  const q = val.toLowerCase();
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function showRejectModal(id, role) {
  const form = document.getElementById('rejectForm');
  form.action = `/${role}/action/${id}`;
  document.getElementById('rejectModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('rejectModal').style.display = 'none';
}

function confirmAction(action) {
  return confirm(`Are you sure you want to ${action} this application?`);
}

// Close modal on backdrop click
document.getElementById('rejectModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
