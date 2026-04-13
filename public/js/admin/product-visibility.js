/**
 * Переключение видимости товара
 */
(function() {
  'use strict';
  
  document.querySelectorAll('.toggle-visibility').forEach(function(toggle) {
    toggle.addEventListener('change', function() {
      var productId = this.dataset.id;
      var isVisible = this.checked;
      var checkbox = this;
      
      fetch('/admin/products/' + productId + '/visibility', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ isVisible: isVisible })
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (!data.success) {
          // Откатываем изменение
          checkbox.checked = !isVisible;
          alert(data.message || 'Ошибка изменения видимости');
        }
      })
      .catch(function(error) {
        console.error('Error:', error);
        // Откатываем изменение
        checkbox.checked = !isVisible;
        alert('Ошибка изменения видимости');
      });
    });
  });
  
})();
