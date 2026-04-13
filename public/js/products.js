const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

document.querySelectorAll('.delete-product-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const row = btn.closest('tr');
    const id = row?.dataset?.id;
    const name = row?.querySelector('td:nth-child(2)')?.textContent?.trim();

    if (!id) return;
    if (!confirm(`Удалить товар "${name}"?`)) return;

    try {
      const res = await fetch(`/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'CSRF-Token': csrfToken
        }
      });

      if (res.ok) {
        row.remove();
        alert('Товар удалён');
      } else {
        const msg = await res.text();
        alert(msg || 'Ошибка при удалении');
      }
    } catch (err) {
      console.error('Ошибка удаления:', err);
      alert('Ошибка при удалении');
    }
  });
});

document.querySelectorAll('.edit-product-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = btn.closest('tr');
    const data = JSON.parse(row?.dataset?.product || '{}');
    if (!data) return;

    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');

    form._id.value = data._id || '';
    form.name.value = data.name || '';
    form.description.value = data.description || '';
    form.price.value = data.price || '';
    form.wholesalePrice.value = data.wholesalePrice || '';
    form.category.value = data.category?._id || '';
    form.quantity.value = data.quantity || '';
    form.warehouse.value = data.warehouse || '';
    form.characteristics.value = Object.entries(data.characteristics || {}).map(([k, v]) => k + ':' + v).join(', ');
    document.getElementById('productImagePreview').src = data.photo || '';

    modal.classList.remove('hidden');
  });
});
