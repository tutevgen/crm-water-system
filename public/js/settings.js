
document.addEventListener('DOMContentLoaded', () => {
  const orgToggleBtn = document.getElementById('toggleOrgBtn');
  const orgForm = document.getElementById('orgForm');
  const toggleText = document.getElementById('toggleOrgBtnText');

  if (orgToggleBtn && orgForm && toggleText) {
    orgToggleBtn.addEventListener('click', () => {
      const hidden = orgForm.classList.toggle('hidden');
      toggleText.textContent = hidden ? 'Показать' : 'Свернуть';
    });
  }

  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');
  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          avatarPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});


  const successAlert = document.getElementById('successAlert');
  if (successAlert) {
    setTimeout(() => {
      successAlert.classList.add('hidden');
    }, 5000);
  }
