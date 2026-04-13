/**
 * proposal-create.js - JavaScript для формы создания КП
 * Подключается в конце proposal-create.ejs
 */

(function() {
  'use strict';
  
  // Инициализация иконок
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Конфигурация
  var isInstallation = window.proposalConfig ? window.proposalConfig.isInstallation : true;
  var totalSteps = isInstallation ? 6 : 5;
  var currentStep = 1;
  var clientDiscount = 0;
  var products = window.proposalConfig ? window.proposalConfig.products : [];
  
  // DOM элементы
  var stepContents = document.querySelectorAll('.step-content');
  var stepItems = document.querySelectorAll('.step-item');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var submitBtn = document.getElementById('submitBtn');
  var itemsContainer = document.getElementById('itemsContainer') || document.getElementById('itemsContainer2');
  var itemTemplate = document.getElementById('itemTemplate');
  
  // ==========================================
  // НАВИГАЦИЯ ПО ШАГАМ
  // ==========================================
  function showStep(step) {
    currentStep = step;
    
    // Скрываем все шаги, показываем нужный
    stepContents.forEach(function(c) { c.classList.remove('active'); });
    var el = document.getElementById('step' + step);
    if (el) el.classList.add('active');
    
    // Обновляем индикаторы
    stepItems.forEach(function(item, i) {
      item.classList.remove('active', 'completed');
      if (i < step - 1) item.classList.add('completed');
      if (i === step - 1) item.classList.add('active');
    });
    
    // Показываем/скрываем кнопки
    if (prevBtn) prevBtn.classList.toggle('hidden', step === 1);
    if (nextBtn) nextBtn.classList.toggle('hidden', step === totalSteps);
    if (submitBtn) submitBtn.classList.toggle('hidden', step !== totalSteps);
    
    // Пересчитываем суммы
    calculateTotals();
    
    // Обновляем иконки
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Скролл вверх
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // Обработчики кнопок навигации
  if (prevBtn) {
    prevBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (currentStep > 1) showStep(currentStep - 1);
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (currentStep < totalSteps) showStep(currentStep + 1);
    });
  }
  
  // ==========================================
  // ВЫБОР КЛИЕНТА
  // ==========================================
  
  // Переключатель существующий/новый клиент
  document.querySelectorAll('input[name="clientType"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      var existingBlock = document.getElementById('existingClientBlock');
      var newBlock = document.getElementById('newClientBlock');
      if (existingBlock) existingBlock.classList.toggle('hidden', this.value === 'new');
      if (newBlock) newBlock.classList.toggle('hidden', this.value === 'existing');
    });
  });
  
  // Поиск клиента
  var clientSearchInput = document.getElementById('clientSearchInput');
  if (clientSearchInput) {
    clientSearchInput.addEventListener('input', function() {
      var query = this.value.toLowerCase();
      document.querySelectorAll('.client-card').forEach(function(card) {
        var name = (card.dataset.name || '').toLowerCase();
        var phone = card.dataset.phone || '';
        var email = (card.dataset.email || '').toLowerCase();
        var match = name.includes(query) || phone.includes(query) || email.includes(query);
        card.style.display = match ? '' : 'none';
      });
    });
  }
  
  // Выбор клиента из карточек
  document.querySelectorAll('.client-radio').forEach(function(radio) {
    radio.addEventListener('change', function() {
      // Снимаем выделение со всех
      document.querySelectorAll('.client-card').forEach(function(card) {
        card.classList.remove('selected');
      });
      
      // Выделяем выбранную
      var card = this.closest('.client-card');
      if (card) card.classList.add('selected');
      
      // Сохраняем скидку клиента
      clientDiscount = parseFloat(this.dataset.discount) || 0;
      var discountInput = document.getElementById('clientDiscountInput');
      if (discountInput) discountInput.value = clientDiscount;
      
      // Заполняем адрес
      var address = this.dataset.address;
      if (address) {
        var addressInput = document.getElementById('objectAddressInput');
        if (addressInput && !addressInput.value) addressInput.value = address;
      }
      
      // Обновляем отображение скидки
      var discountRow = document.getElementById('clientDiscountRow');
      if (discountRow) {
        discountRow.classList.toggle('hidden', clientDiscount === 0);
        var pctEl = document.getElementById('clientDiscountPct');
        if (pctEl) pctEl.textContent = clientDiscount;
      }
      
      calculateTotals();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  });
  
  // ==========================================
  // АНАЛИЗ ВОДЫ - подсветка превышений
  // ==========================================
  document.querySelectorAll('.analysis-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var norm = parseFloat(this.dataset.norm);
      var val = parseFloat(this.value) || 0;
      this.classList.toggle('exceeded', norm && val > norm);
    });
  });
  
  // Файл анализа
  var analysisFileInput = document.getElementById('analysisFileInput');
  if (analysisFileInput) {
    analysisFileInput.addEventListener('change', function() {
      var nameEl = document.getElementById('analysisFileName');
      if (nameEl) {
        nameEl.textContent = this.files.length ? this.files[0].name : 'Файл не выбран';
      }
    });
  }
  
  // ==========================================
  // ОБОРУДОВАНИЕ / МАТЕРИАЛЫ
  // ==========================================
  
  function addItem(data) {
    data = data || {};
    var container = document.getElementById('itemsContainer') || document.getElementById('itemsContainer2');
    var template = document.getElementById('itemTemplate');
    if (!container || !template) return;
    
    var clone = template.content.cloneNode(true);
    var row = clone.querySelector('.item-row');
    
    // Заполняем поля
    var nameInput = row.querySelector('.item-name');
    var productIdInput = row.querySelector('.item-product-id');
    var skuInput = row.querySelector('.item-sku');
    var quantityInput = row.querySelector('.item-quantity');
    var priceInput = row.querySelector('.item-price');
    var descInput = row.querySelector('.item-description');
    var imageUrlInput = row.querySelector('.item-image-url');
    var imageContainer = row.querySelector('.item-image');
    
    if (nameInput) nameInput.value = data.name || '';
    if (productIdInput) productIdInput.value = data.productId || data._id || '';
    if (skuInput) skuInput.value = data.sku || '';
    if (quantityInput) quantityInput.value = data.quantity || 1;
    if (priceInput) priceInput.value = data.price || 0;
    if (descInput) descInput.value = data.description || '';
    
    // Изображение
    if (data.image && imageContainer) {
      imageContainer.innerHTML = '<img src="' + data.image + '" alt="" class="max-w-full max-h-full object-contain">';
      if (imageUrlInput) imageUrlInput.value = data.image;
    }
    
    // Удаление позиции
    var removeBtn = row.querySelector('.remove-item');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        row.remove();
        calculateTotals();
      });
    }
    
    // Пересчёт при изменении
    if (quantityInput) {
      quantityInput.addEventListener('input', function() {
        updateItemTotal(row);
        calculateTotals();
      });
    }
    if (priceInput) {
      priceInput.addEventListener('input', function() {
        updateItemTotal(row);
        calculateTotals();
      });
    }
    
    container.appendChild(clone);
    updateItemTotal(container.lastElementChild);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    calculateTotals();
  }
  
  function updateItemTotal(row) {
    var qty = parseFloat(row.querySelector('.item-quantity')?.value) || 0;
    var price = parseFloat(row.querySelector('.item-price')?.value) || 0;
    var totalEl = row.querySelector('.item-total');
    if (totalEl) {
      totalEl.textContent = (qty * price).toLocaleString('ru-RU') + ' ₽';
    }
  }
  
  // Глобальная функция для добавления
  window.addItem = addItem;
  
  // Кнопки добавления
  var addItemBtn = document.getElementById('addItemBtn');
  var addItemBtn2 = document.getElementById('addItemBtn2');
  
  if (addItemBtn) {
    addItemBtn.addEventListener('click', function(e) {
      e.preventDefault();
      addItem({});
    });
  }
  if (addItemBtn2) {
    addItemBtn2.addEventListener('click', function(e) {
      e.preventDefault();
      addItem({});
    });
  }
  
  // ==========================================
  // КАТАЛОГ ТОВАРОВ
  // ==========================================
  var catalogModal = document.getElementById('catalogModal');
  var catalogOverlay = document.getElementById('catalogOverlay');
  var closeCatalogBtn = document.getElementById('closeCatalogBtn');
  var catalogSearchInput = document.getElementById('catalogSearchInput');
  var catalogProductsGrid = document.getElementById('catalogProductsGrid');
  
  function openCatalog() {
    if (catalogModal) {
      catalogModal.classList.remove('hidden');
      renderCatalogProducts(products);
      if (catalogSearchInput) catalogSearchInput.value = '';
    }
  }
  
  function closeCatalog() {
    if (catalogModal) catalogModal.classList.add('hidden');
  }
  
  function renderCatalogProducts(list) {
    if (!catalogProductsGrid) return;
    catalogProductsGrid.innerHTML = '';
    
    if (!list || list.length === 0) {
      catalogProductsGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">Товары не найдены</div>';
      return;
    }
    
    list.forEach(function(product) {
      var card = document.createElement('div');
      card.className = 'catalog-product bg-white border rounded-xl p-3 cursor-pointer hover:shadow-lg transition';
      card.innerHTML = 
        '<div class="h-20 flex items-center justify-center mb-2 bg-gray-50 rounded-lg">' +
          (product.image 
            ? '<img src="' + product.image + '" alt="" class="max-h-full object-contain">' 
            : '<svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>') +
        '</div>' +
        '<div class="text-sm font-medium truncate">' + (product.name || '') + '</div>' +
        '<div class="text-xs text-gray-400 truncate">' + (product.sku || '') + '</div>' +
        '<div class="text-sm font-bold text-blue-600 mt-1">' + (product.price || 0).toLocaleString('ru-RU') + ' ₽</div>';
      
      card.addEventListener('click', function() {
        addItem({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          image: product.image,
          description: product.description || ''
        });
        closeCatalog();
      });
      
      catalogProductsGrid.appendChild(card);
    });
  }
  
  // Открытие каталога
  var openCatalogBtn = document.getElementById('openCatalogBtn');
  var openCatalogBtn2 = document.getElementById('openCatalogBtn2');
  if (openCatalogBtn) openCatalogBtn.addEventListener('click', function(e) { e.preventDefault(); openCatalog(); });
  if (openCatalogBtn2) openCatalogBtn2.addEventListener('click', function(e) { e.preventDefault(); openCatalog(); });
  
  // Закрытие каталога
  if (closeCatalogBtn) closeCatalogBtn.addEventListener('click', closeCatalog);
  if (catalogOverlay) catalogOverlay.addEventListener('click', closeCatalog);
  
  // Поиск в каталоге
  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', function() {
      var query = this.value.toLowerCase();
      var filtered = products.filter(function(p) {
        return (p.name || '').toLowerCase().includes(query) || 
               (p.sku || '').toLowerCase().includes(query);
      });
      renderCatalogProducts(filtered);
    });
  }
  
  // ==========================================
  // УСЛУГИ - пересчёт при изменении
  // ==========================================
  document.querySelectorAll('.service-checkbox, .service-price').forEach(function(el) {
    el.addEventListener('change', calculateTotals);
    el.addEventListener('input', calculateTotals);
  });
  
  // ==========================================
  // МАТЕРИАЛ ОБВЯЗКИ
  // ==========================================
  document.querySelectorAll('.piping-radio').forEach(function(radio) {
    radio.addEventListener('change', function() {
      var price = parseFloat(this.dataset.price) || 0;
      var priceInput = document.getElementById('pipingPriceInput');
      if (priceInput) priceInput.value = price;
      
      // Обновляем визуальное выделение
      document.querySelectorAll('.piping-option').forEach(function(opt) {
        var innerDot = opt.querySelector('.piping-inner');
        var isChecked = opt.querySelector('input').checked;
        if (innerDot) innerDot.style.opacity = isChecked ? '1' : '0';
      });
      
      calculateTotals();
    });
  });
  
  // Инициализация выделения обвязки
  document.querySelectorAll('.piping-option').forEach(function(opt) {
    var radio = opt.querySelector('input');
    var innerDot = opt.querySelector('.piping-inner');
    if (radio && radio.checked && innerDot) {
      innerDot.style.opacity = '1';
    }
  });
  
  // ==========================================
  // ОПЦИИ - подсветка выбранных
  // ==========================================
  document.querySelectorAll('.option-checkbox').forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
      var item = this.closest('.option-item');
      if (item) item.classList.toggle('selected', this.checked);
    });
  });
  
  // ==========================================
  // СХЕМЫ И ФОТО - переключение источника
  // ==========================================
  document.querySelectorAll('.schema-source-radio').forEach(function(radio) {
    radio.addEventListener('change', function() {
      var libraryBlock = document.getElementById('schemaLibraryBlock');
      var uploadBlock = document.getElementById('schemaUploadBlock');
      if (libraryBlock) libraryBlock.classList.toggle('hidden', this.value !== 'library');
      if (uploadBlock) uploadBlock.classList.toggle('hidden', this.value !== 'upload');
    });
  });
  
  document.querySelectorAll('.photos-source-radio').forEach(function(radio) {
    radio.addEventListener('change', function() {
      var libraryBlock = document.getElementById('photosLibraryBlock');
      var uploadBlock = document.getElementById('photosUploadBlock');
      if (libraryBlock) libraryBlock.classList.toggle('hidden', this.value !== 'library');
      if (uploadBlock) uploadBlock.classList.toggle('hidden', this.value !== 'upload');
    });
  });
  
  // Превью загруженной схемы
  var schemaFileInput = document.getElementById('schemaFileInput');
  if (schemaFileInput) {
    schemaFileInput.addEventListener('change', function() {
      var preview = document.getElementById('schemaPreview');
      var previewImg = document.getElementById('schemaPreviewImg');
      if (this.files.length && preview && previewImg) {
        var reader = new FileReader();
        reader.onload = function(e) {
          previewImg.src = e.target.result;
          preview.classList.remove('hidden');
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }
  
  // Ограничение выбора фото (максимум 3)
  document.querySelectorAll('.work-photo-checkbox').forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
      var selected = document.querySelectorAll('.work-photo-checkbox:checked');
      if (selected.length > 3) {
        this.checked = false;
        alert('Можно выбрать максимум 3 фотографии');
      }
    });
  });
  
  // ==========================================
  // РАСЧЁТ ИТОГОВ
  // ==========================================
  function calculateTotals() {
    // Оборудование
    var equipmentTotal = 0;
    var container = document.getElementById('itemsContainer') || document.getElementById('itemsContainer2');
    if (container) {
      container.querySelectorAll('.item-row').forEach(function(row) {
        var qtyEl = row.querySelector('.item-quantity');
        var priceEl = row.querySelector('.item-price');
        var qty = qtyEl ? (parseFloat(qtyEl.value) || 0) : 0;
        var price = priceEl ? (parseFloat(priceEl.value) || 0) : 0;
        equipmentTotal += qty * price;
      });
    }
    
    // Услуги
    var servicesTotal = 0;
    document.querySelectorAll('.service-checkbox').forEach(function(checkbox) {
      if (checkbox.checked) {
        var label = checkbox.closest('label');
        var priceInput = label ? label.querySelector('.service-price') : null;
        if (priceInput) {
          servicesTotal += parseFloat(priceInput.value) || 0;
        }
      }
    });
    
    // Материал обвязки
    var pipingPrice = 0;
    var pipingInput = document.getElementById('pipingPriceInput');
    if (pipingInput) pipingPrice = parseFloat(pipingInput.value) || 0;
    
    // Подытог
    var subtotal = equipmentTotal + servicesTotal + pipingPrice;
    
    // Скидка клиента
    var clientDiscountAmount = subtotal * clientDiscount / 100;
    var afterClientDiscount = subtotal - clientDiscountAmount;
    
    // Доп. скидка
    var discountInput = document.getElementById('discountInput');
    var discountPercent = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
    var discountAmount = afterClientDiscount * discountPercent / 100;
    
    // Итого
    var total = afterClientDiscount - discountAmount;
    
    // Обновляем UI
    var format = function(n) { return n.toLocaleString('ru-RU') + ' ₽'; };
    
    // Для installation
    var eqEl = document.getElementById('equipmentTotal');
    if (eqEl) eqEl.textContent = format(equipmentTotal);
    
    var svcEl = document.getElementById('servicesTotal');
    if (svcEl) svcEl.textContent = format(servicesTotal);
    
    var sumEq = document.getElementById('summaryEquipment');
    if (sumEq) sumEq.textContent = format(equipmentTotal);
    
    var sumSvc = document.getElementById('summaryServices');
    if (sumSvc) sumSvc.textContent = format(servicesTotal);
    
    var sumPip = document.getElementById('summaryPiping');
    if (sumPip) sumPip.textContent = format(pipingPrice);
    
    var sumSub = document.getElementById('summarySubtotal');
    if (sumSub) sumSub.textContent = format(subtotal);
    
    var clientDiscRow = document.getElementById('clientDiscountRow');
    if (clientDiscRow) {
      clientDiscRow.classList.toggle('hidden', clientDiscount === 0);
      var cdEl = document.getElementById('summaryClientDiscount');
      if (cdEl) cdEl.textContent = '-' + format(clientDiscountAmount);
    }
    
    var discRow = document.getElementById('discountRow');
    if (discRow) {
      discRow.classList.toggle('hidden', discountPercent === 0);
      var dEl = document.getElementById('summaryDiscount');
      if (dEl) dEl.textContent = '-' + format(discountAmount);
    }
    
    var sumTotal = document.getElementById('summaryTotal');
    if (sumTotal) sumTotal.textContent = format(total);
    
    // Для не-installation (другой набор элементов)
    var eqEl2 = document.getElementById('equipmentTotal2');
    if (eqEl2) eqEl2.textContent = format(equipmentTotal);
    
    var svcEl2 = document.getElementById('servicesTotal2');
    if (svcEl2) svcEl2.textContent = format(servicesTotal);
    
    var sumEq2 = document.getElementById('summaryEquipment2');
    if (sumEq2) sumEq2.textContent = format(equipmentTotal);
    
    var sumSvc2 = document.getElementById('summaryServices2');
    if (sumSvc2) sumSvc2.textContent = format(servicesTotal);
    
    var sumSub2 = document.getElementById('summarySubtotal2');
    if (sumSub2) sumSub2.textContent = format(equipmentTotal + servicesTotal);
    
    var sumTotal2 = document.getElementById('summaryTotal2');
    if (sumTotal2) sumTotal2.textContent = format(equipmentTotal + servicesTotal);
  }
  
  // Пересчёт при изменении скидки
  var discountInput = document.getElementById('discountInput');
  if (discountInput) {
    discountInput.addEventListener('input', calculateTotals);
  }
  
  // ==========================================
  // ИНИЦИАЛИЗАЦИЯ
  // ==========================================
  
  // Добавляем пустую позицию по умолчанию
  setTimeout(function() {
    var container = document.getElementById('itemsContainer') || document.getElementById('itemsContainer2');
    if (container && container.children.length === 0) {
      addItem({});
    }
    calculateTotals();
  }, 100);
  
})();
