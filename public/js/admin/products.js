/**
 * Управление товарами - основной скрипт
 */
(function() {
  'use strict';
  
  // Элементы DOM
  var productModal = document.getElementById('productModal');
  var productForm = document.getElementById('productForm');
  var productModalTitle = document.getElementById('productModalTitle');
  var openProductBtn = document.getElementById('openProductBtn');
  var openProductBtnEmpty = document.getElementById('openProductBtnEmpty');
  var closeProductModal = document.getElementById('closeProductModal');
  var productModalOverlay = document.getElementById('productModalOverlay');
  var cancelProductBtn = document.getElementById('cancelProductBtn');
  
  var categoryModal = document.getElementById('categoryModal');
  var categoryForm = document.getElementById('categoryForm');
  var openCategoryBtn = document.getElementById('openCategoryBtn');
  var closeCategoryModal = document.getElementById('closeCategoryModal');
  var categoryModalOverlay = document.getElementById('categoryModalOverlay');
  
  // Поля формы товара
  var productId = document.getElementById('productId');
  var productName = document.getElementById('productName');
  var productCategory = document.getElementById('productCategory');
  var productPrice = document.getElementById('productPrice');
  var productWholesalePrice = document.getElementById('productWholesalePrice');
  var productWarehouse = document.getElementById('productWarehouse');
  var productUnit = document.getElementById('productUnit');
  var productQuantity = document.getElementById('productQuantity');
  var productSku = document.getElementById('productSku');
  var productIsVisible = document.getElementById('productIsVisible');
  var productIsFeatured = document.getElementById('productIsFeatured');
  var productPhoto = document.getElementById('productPhoto');
  var productDescription = document.getElementById('productDescription');
  var photoPreview = document.getElementById('photoPreview');
  var photoPlaceholder = document.getElementById('photoPlaceholder');
  var photoDropZone = document.getElementById('photoDropZone');
  
  // Поля формы категории
  var categoryId = document.getElementById('categoryId');
  var categoryName = document.getElementById('categoryName');
  var categoryParent = document.getElementById('categoryParent');
  var saveCategoryBtn = document.getElementById('saveCategoryBtn');
  
  // Характеристики
  var characteristicsContainer = document.getElementById('characteristicsContainer');
  var addCharacteristicBtn = document.getElementById('addCharacteristic');
  
  // ============================================
  // МОДАЛЬНОЕ ОКНО ТОВАРА
  // ============================================
  
  function openProductModal(product) {
    if (!productModal) return;
    
    // Сбрасываем форму
    productForm.reset();
    productId.value = '';
    characteristicsContainer.innerHTML = '';
    hidePhotoPreview();
    
    if (product) {
      // Режим редактирования
      productModalTitle.textContent = 'Редактировать товар';
      productId.value = product._id;
      productName.value = product.name || '';
      productCategory.value = product.category ? (product.category._id || product.category) : '';
      productPrice.value = product.price || '';
      productWholesalePrice.value = product.wholesalePrice || '';
      productWarehouse.value = product.warehouse || '';
      productUnit.value = product.unit || 'шт';
      productQuantity.value = product.quantity || 0;
      productSku.value = product.sku || '';
      productIsVisible.checked = product.isVisible !== false;
      productIsFeatured.checked = product.isFeatured === true;
      productDescription.value = product.description || '';
      
      // Показываем текущее фото
      if (product.photo) {
        showPhotoPreview(product.photo);
      }
      
      // Загружаем характеристики
      if (product.characteristics) {
        var chars = product.characteristics;
        if (chars instanceof Map) {
          chars.forEach(function(value, key) {
            addCharacteristicField(key, value);
          });
        } else if (typeof chars === 'object') {
          Object.keys(chars).forEach(function(key) {
            addCharacteristicField(key, chars[key]);
          });
        }
      }
    } else {
      // Режим добавления
      productModalTitle.textContent = 'Добавить товар';
      productIsVisible.checked = true;
    }
    
    productModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Обновляем иконки
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  function closeProductModalFn() {
    if (!productModal) return;
    productModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  
  // ============================================
  // ФОТО ТОВАРА
  // ============================================
  
  function showPhotoPreview(src) {
    var img = photoPreview.querySelector('img');
    img.src = src;
    photoPreview.classList.remove('hidden');
    photoPlaceholder.classList.add('hidden');
  }
  
  function hidePhotoPreview() {
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
  }
  
  if (photoDropZone) {
    photoDropZone.addEventListener('click', function() {
      productPhoto.click();
    });
    
    photoDropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      photoDropZone.classList.add('border-gray-400', 'bg-gray-50');
    });
    
    photoDropZone.addEventListener('dragleave', function() {
      photoDropZone.classList.remove('border-gray-400', 'bg-gray-50');
    });
    
    photoDropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      photoDropZone.classList.remove('border-gray-400', 'bg-gray-50');
      
      var files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        productPhoto.files = files;
        previewImage(files[0]);
      }
    });
  }
  
  if (productPhoto) {
    productPhoto.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        previewImage(this.files[0]);
      }
    });
  }
  
  function previewImage(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      showPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }
  
  // ============================================
  // ХАРАКТЕРИСТИКИ
  // ============================================
  
  function addCharacteristicField(key, value) {
    var div = document.createElement('div');
    div.className = 'flex gap-2 items-center characteristic-row';
    div.innerHTML = 
      '<input type="text" name="charKey[]" value="' + (key || '') + '" placeholder="Название" ' +
      'class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">' +
      '<input type="text" name="charValue[]" value="' + (value || '') + '" placeholder="Значение" ' +
      'class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">' +
      '<button type="button" class="remove-char-btn p-2 text-red-500 hover:bg-red-50 rounded-lg">' +
      '<i data-lucide="x" class="w-4 h-4"></i></button>';
    
    characteristicsContainer.appendChild(div);
    
    // Обработчик удаления
    div.querySelector('.remove-char-btn').addEventListener('click', function() {
      div.remove();
    });
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  if (addCharacteristicBtn) {
    addCharacteristicBtn.addEventListener('click', function() {
      addCharacteristicField('', '');
    });
  }
  
  // ============================================
  // СОХРАНЕНИЕ ТОВАРА
  // ============================================
  
  if (productForm) {
    productForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      var formData = new FormData(productForm);
      
      // Собираем характеристики
      var charKeys = formData.getAll('charKey[]');
      var charValues = formData.getAll('charValue[]');
      var characteristics = {};
      
      for (var i = 0; i < charKeys.length; i++) {
        if (charKeys[i] && charKeys[i].trim()) {
          characteristics[charKeys[i].trim()] = charValues[i] || '';
        }
      }
      
      // Удаляем старые поля характеристик
      formData.delete('charKey[]');
      formData.delete('charValue[]');
      
      // Добавляем характеристики как JSON
      formData.append('characteristics', JSON.stringify(characteristics));
      
      // Чекбоксы
      formData.set('isVisible', productIsVisible.checked ? 'true' : 'false');
      formData.set('isFeatured', productIsFeatured.checked ? 'true' : 'false');
      
      var isEdit = !!productId.value;
      var url = isEdit ? '/admin/products/' + productId.value : '/admin/products';
      var method = isEdit ? 'PUT' : 'POST';
      
      // Показываем индикатор загрузки
      var saveBtn = document.getElementById('saveProductBtn');
      var originalText = saveBtn.textContent;
      saveBtn.textContent = 'Сохранение...';
      saveBtn.disabled = true;
      
      fetch(url, {
        method: method,
        body: formData,
        headers: {
          'X-CSRF-Token': csrfToken
        }
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          closeProductModalFn();
          // Перезагружаем страницу для обновления списка
          window.location.reload();
        } else {
          alert(data.message || 'Ошибка сохранения товара');
        }
      })
      .catch(function(error) {
        console.error('Error:', error);
        alert('Ошибка сохранения товара');
      })
      .finally(function() {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      });
    });
  }
  
  // ============================================
  // УДАЛЕНИЕ ТОВАРА
  // ============================================
  
  document.querySelectorAll('.delete-product-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var row = this.closest('tr');
      var id = row.dataset.id;
      var productData = JSON.parse(row.dataset.product || '{}');
      var name = productData.name || 'товар';
      
      if (confirm('Удалить "' + name + '"?')) {
        fetch('/admin/products/' + id, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
          }
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          if (data.success) {
            row.remove();
          } else {
            alert(data.message || 'Ошибка удаления');
          }
        })
        .catch(function(error) {
          console.error('Error:', error);
          alert('Ошибка удаления товара');
        });
      }
    });
  });
  
  // ============================================
  // РЕДАКТИРОВАНИЕ ТОВАРА
  // ============================================
  
  document.querySelectorAll('.edit-product-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var row = this.closest('tr');
      var productData = JSON.parse(row.dataset.product || '{}');
      openProductModal(productData);
    });
  });
  
  // ============================================
  // МОДАЛЬНОЕ ОКНО КАТЕГОРИЙ
  // ============================================
  
  function openCategoryModalFn() {
    if (!categoryModal) return;
    categoryModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetCategoryForm();
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  function closeCategoryModalFn() {
    if (!categoryModal) return;
    categoryModal.classList.add('hidden');
    document.body.style.overflow = '';
    resetCategoryForm();
  }
  
  function resetCategoryForm() {
    if (categoryForm) {
      categoryForm.reset();
    }
    if (categoryId) {
      categoryId.value = '';
    }
    if (saveCategoryBtn) {
      saveCategoryBtn.innerHTML = '<i data-lucide="plus" class="w-5 h-5"></i>';
    }
  }
  
  // Сохранение категории
  if (categoryForm) {
    categoryForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      var isEdit = !!categoryId.value;
      var url = isEdit ? '/categories/' + categoryId.value : '/categories';
      var method = isEdit ? 'PUT' : 'POST';
      
      var formData = {
        name: categoryName.value,
        parent: categoryParent.value || null,
        _csrf: csrfToken
      };
      
      fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(formData)
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          window.location.reload();
        } else {
          alert(data.message || 'Ошибка сохранения категории');
        }
      })
      .catch(function(error) {
        console.error('Error:', error);
        alert('Ошибка сохранения категории');
      });
    });
  }
  
  // Редактирование категории
  document.querySelectorAll('.edit-category-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.dataset.id;
      var name = this.dataset.name;
      var parent = this.dataset.parent || '';
      
      categoryId.value = id;
      categoryName.value = name;
      categoryParent.value = parent;
      saveCategoryBtn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    });
  });
  
  // Удаление категории
  document.querySelectorAll('.delete-category-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.dataset.id;
      
      if (confirm('Удалить категорию? Товары в этой категории останутся без категории.')) {
        fetch('/categories/' + id, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
          }
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          if (data.success) {
            window.location.reload();
          } else {
            alert(data.message || 'Ошибка удаления категории');
          }
        })
        .catch(function(error) {
          console.error('Error:', error);
          alert('Ошибка удаления категории');
        });
      }
    });
  });
  
  // ============================================
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // ============================================
  
  // Открытие модалок
  if (openProductBtn) {
    openProductBtn.addEventListener('click', function() {
      openProductModal(null);
    });
  }
  
  if (openProductBtnEmpty) {
    openProductBtnEmpty.addEventListener('click', function() {
      openProductModal(null);
    });
  }
  
  if (openCategoryBtn) {
    openCategoryBtn.addEventListener('click', openCategoryModalFn);
  }
  
  // Закрытие модалок
  if (closeProductModal) {
    closeProductModal.addEventListener('click', closeProductModalFn);
  }
  
  if (productModalOverlay) {
    productModalOverlay.addEventListener('click', closeProductModalFn);
  }
  
  if (cancelProductBtn) {
    cancelProductBtn.addEventListener('click', closeProductModalFn);
  }
  
  if (closeCategoryModal) {
    closeCategoryModal.addEventListener('click', closeCategoryModalFn);
  }
  
  if (categoryModalOverlay) {
    categoryModalOverlay.addEventListener('click', closeCategoryModalFn);
  }
  
  // Закрытие по Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeProductModalFn();
      closeCategoryModalFn();
    }
  });
  
})();
