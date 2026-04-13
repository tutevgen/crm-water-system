/**
 * Фильтры и поиск товаров
 */
(function() {
  'use strict';
  
  var filterForm = document.getElementById('filterForm');
  var searchInput = filterForm ? filterForm.querySelector('input[name="search"]') : null;
  var debounceTimer;
  
  // Авто-отправка формы при изменении select
  if (filterForm) {
    filterForm.querySelectorAll('select').forEach(function(select) {
      select.addEventListener('change', function() {
        filterForm.submit();
      });
    });
  }
  
  // Поиск с задержкой (debounce)
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        filterForm.submit();
      }, 500);
    });
    
    // Отправка по Enter
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        filterForm.submit();
      }
    });
  }
  
})();
