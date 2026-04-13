// public/js/categories.js

function openCategoryModal(category = null) {
  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('categoryForm');
  if (!modal || !form) return;

  form.reset();
  form._id.value = '';
  document.getElementById('categoryModalTitle').innerText = category ? 'Редактировать категорию' : 'Новая категория';

  if (category) {
    form._id.value = category._id;
    form.name.value = category.name;
    form.parent.value = category.parent || '';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openCategoryBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      console.log('Открытие модального окна категории');
      openCategoryModal();
    });
  }

  const form = document.getElementById('categoryForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const method = data._id ? 'PUT' : 'POST';
      const url = data._id ? `/categories/${data._id}` : '/categories';

      const res = await fetch(url, {
        method,
        headers: {
  'Content-Type': 'application/json',
  'CSRF-Token': window.csrfToken
}
,
        body: JSON.stringify(data)
      });

      if (res.ok) {
        location.reload();
      } else {
        alert('Ошибка при сохранении категории');
      }
    });
  }
});

function editCategory(id, name, parent) {
  openCategoryModal({ _id: id, name, parent });
}

async function deleteCategory(id) {
  if (!confirm('Удалить категорию?')) return;
  const res = await fetch(`/categories/${id}`, {
    method: 'DELETE',
    headers: { 'CSRF-Token': window.csrfToken }
  });

  if (res.ok) location.reload();
  else alert('Нельзя удалить: возможно, в категории есть товары');
}
