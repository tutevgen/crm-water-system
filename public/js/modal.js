// public/js/modal.js

document.addEventListener('DOMContentLoaded', function () {
  const openBtn = document.getElementById('openBookServiceModal');
  const modalOverlay = document.querySelector('.modal-overlay');
  const modalBackdrop = document.querySelector('.modal-backdrop');
  const modalCloseBtn = document.querySelector('.modal-close');

  if (!openBtn || !modalOverlay || !modalBackdrop || !modalCloseBtn) return;

  // Открытие модала
  openBtn.addEventListener('click', function () {
    modalOverlay.classList.remove('hidden');
    modalBackdrop.classList.remove('hidden');
  });

  // Закрытие по крестику
  modalCloseBtn.addEventListener('click', function () {
    modalOverlay.classList.add('hidden');
    modalBackdrop.classList.add('hidden');
  });

  // Закрытие по клику вне окна
  modalBackdrop.addEventListener('click', function () {
    modalOverlay.classList.add('hidden');
    modalBackdrop.classList.add('hidden');
  });
});