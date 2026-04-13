
document.addEventListener('DOMContentLoaded', () => {
  const success = document.getElementById('successAlert');
  if (success) {
    setTimeout(() => {
      success.classList.add('hidden');
    }, 5000);
  }
});
