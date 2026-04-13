/**
 * proposal-create.js - Логика формы создания КП
 */
(function() {
  'use strict';
  
  var config = window.PROPOSAL_CONFIG || {};
  var step = 1;
  var total = config.totalSteps || 6;
  var isInst = config.isInstallation || false;
  var products = config.products || [];
  var clientDiscount = 0;
  var pipingPrice = 8000;

  // === НАВИГАЦИЯ ===
  function showStep(n) {
    if (n < 1 || n > total) return;
    step = n;
    
    for (var i = 1; i <= total; i++) {
      var el = document.getElementById('step' + i);
      var dot = document.querySelector('.step-dot[data-step="' + i + '"]');
      if (el) el.classList.toggle('active', i === n);
      if (dot) {
        dot.classList.remove('active', 'done');
        if (i === n) dot.classList.add('active');
        if (i < n) dot.classList.add('done');
      }
    }
    
    document.getElementById('btnPrev').classList.toggle('hidden', n === 1);
    document.getElementById('btnNext').classList.toggle('hidden', n === total);
    document.getElementById('btnSubmit').classList.toggle('hidden', n !== total);
    calcTotals();
  }

  // === КЛИЕНТЫ ===
  function toggleClientType() {
    var isNew = document.querySelector('input[name="clientType"]:checked').value === 'new';
    document.getElementById('existingBlock').classList.toggle('hidden', isNew);
    document.getElementById('newBlock').classList.toggle('hidden', !isNew);
  }

  function filterClients() {
    var q = (document.getElementById('clientSearch').value || '').toLowerCase();
    document.querySelectorAll('.client-card').forEach(function(c) {
      var match = (c.dataset.name || '').indexOf(q) !== -1 || (c.dataset.phone || '').indexOf(q) !== -1;
      c.style.display = match ? '' : 'none';
    });
  }

  function selectClient(card) {
    document.querySelectorAll('.client-card').forEach(function(c) { c.classList.remove('selected'); });
    card.classList.add('selected');
    document.getElementById('clientIdInput').value = card.dataset.id;
    document.getElementById('clientDiscountInput').value = card.dataset.discount || 0;
    clientDiscount = parseFloat(card.dataset.discount) || 0;
    if (card.dataset.address) document.getElementById('addressInput').value = card.dataset.address;
  }

  // FIX #29: экранирование HTML — защита от XSS через данные товаров
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // === ТОВАРЫ ===
  function addItem(data, containerId) {
    data = data || {};
    var container = document.getElementById(containerId || 'itemsContainer') || document.getElementById('itemsContainer2');
    if (!container) return;

    var row = document.createElement('div');
    row.className = 'item-row';

    // FIX #29: используем DOM API вместо innerHTML для пользовательских данных
    var img = data.image ? '<img src="' + esc(data.image) + '">' : '📦';

    row.innerHTML =
      '<button type="button" class="rm-btn">×</button>' +
      '<div class="item-img">' + img + '</div>' +
      '<div class="item-fields">' +
        '<div><label class="label">Название</label>' +
          '<input type="text" name="items[][name]" value="' + esc(data.name) + '" class="input item-name">' +
          '<input type="hidden" name="items[][productId]" value="' + esc(data.productId) + '">' +
          '<input type="hidden" name="items[][sku]" value="' + esc(data.sku) + '">' +
          '<input type="hidden" name="items[][image]" value="' + esc(data.image) + '">' +
        '</div>' +
        '<div><label class="label">Кол-во</label><input type="number" name="items[][quantity]" value="' + (parseInt(data.quantity) || 1) + '" min="1" class="input item-qty text-center"></div>' +
        '<div><label class="label">Цена</label><input type="number" name="items[][price]" value="' + (parseFloat(data.price) || 0) + '" min="0" class="input item-price" style="text-align:right"></div>' +
        '<div><label class="label">Сумма</label><div class="item-sum">0 ₽</div></div>' +
      '</div>';

    container.appendChild(row);

    row.querySelector('.rm-btn').onclick = function() { row.remove(); calcTotals(); };
    row.querySelector('.item-qty').oninput = calcTotals;
    row.querySelector('.item-price').oninput = calcTotals;
    calcTotals();
  }

  // === КАТАЛОГ ===
  function openCatalog() {
    document.getElementById('catalogModal').classList.add('active');
    renderCatalog(products);
  }

  function closeCatalog() {
    document.getElementById('catalogModal').classList.remove('active');
  }

  function filterCatalog() {
    var q = (document.getElementById('catalogSearch').value || '').toLowerCase();
    var filtered = products.filter(function(p) {
      return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.sku || '').toLowerCase().indexOf(q) !== -1;
    });
    renderCatalog(filtered);
  }

  function renderCatalog(list) {
    var grid = document.getElementById('catalogGrid');
    grid.innerHTML = '';
    
    if (!list.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#6b7280;padding:40px">Не найдено</p>';
      return;
    }
    
    list.forEach(function(p) {
      var div = document.createElement('div');
      div.className = 'catalog-item';
      var img = p.image ? '<img src="' + p.image + '">' : '<span style="font-size:32px">📦</span>';
      div.innerHTML = 
        '<div style="height:70px;display:flex;align-items:center;justify-content:center">' + img + '</div>' +
        '<div class="name">' + p.name + '</div>' +
        '<div class="sku">' + (p.sku || '') + '</div>' +
        '<div class="price">' + (p.price || 0).toLocaleString('ru-RU') + ' ₽</div>';
      
      div.onclick = function() {
        addItem({ productId: p._id, name: p.name, sku: p.sku, price: p.price, image: p.image });
        closeCatalog();
      };
      grid.appendChild(div);
    });
  }

  // === ОБВЯЗКА ===
  function selectPiping(card) {
    document.querySelectorAll('.piping-card').forEach(function(c) { c.classList.remove('selected'); });
    card.classList.add('selected');
    var priceInput = card.querySelector('.piping-price');
    pipingPrice = priceInput ? parseFloat(priceInput.value) || 0 : 0;
    document.getElementById('pipingMaterialInput').value = card.dataset.value;
    document.getElementById('pipingPriceInput').value = pipingPrice;
    calcTotals();
  }

  // === РАСЧЁТЫ ===
  function calcTotals() {
    var eqTotal = 0;
    document.querySelectorAll('.item-row').forEach(function(row) {
      var qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
      var price = parseFloat(row.querySelector('.item-price')?.value) || 0;
      var sum = qty * price;
      eqTotal += sum;
      var sumEl = row.querySelector('.item-sum');
      if (sumEl) sumEl.textContent = sum.toLocaleString('ru-RU') + ' ₽';
    });
    
    var el1 = document.getElementById('equipmentTotal');
    var el2 = document.getElementById('equipmentTotal2');
    if (el1) el1.textContent = eqTotal.toLocaleString('ru-RU') + ' ₽';
    if (el2) el2.textContent = eqTotal.toLocaleString('ru-RU') + ' ₽';
    
    var svcTotal = 0;
    document.querySelectorAll('.service-cb').forEach(function(cb) {
      if (cb.checked) {
        var pr = cb.closest('label')?.querySelector('.service-price');
        if (pr) svcTotal += parseFloat(pr.value) || 0;
      }
    });
    
    var svcEl = document.getElementById('servicesTotal');
    var svcEl2 = document.getElementById('servicesTotal2');
    if (svcEl) svcEl.textContent = svcTotal.toLocaleString('ru-RU') + ' ₽';
    if (svcEl2) svcEl2.textContent = svcTotal.toLocaleString('ru-RU') + ' ₽';
    
    // Обновить цену обвязки
    var selectedPiping = document.querySelector('.piping-card.selected .piping-price');
    if (selectedPiping) pipingPrice = parseFloat(selectedPiping.value) || 0;
    
    var subtotal = eqTotal + svcTotal + (isInst ? pipingPrice : 0);
    var discInput = document.getElementById('discountInput');
    var discPct = discInput ? parseFloat(discInput.value) || 0 : 0;
    var totalDisc = clientDiscount + discPct;
    var discAmt = subtotal * totalDisc / 100;
    var total = subtotal - discAmt;
    
    var sumEquip = document.getElementById('sumEquip');
    var sumEquip2 = document.getElementById('sumEquip2');
    var sumSvc = document.getElementById('sumSvc');
    var sumSvc2 = document.getElementById('sumSvc2');
    var sumPiping = document.getElementById('sumPiping');
    var sumTotal = document.getElementById('sumTotal');
    var sumTotal2 = document.getElementById('sumTotal2');
    var discountRow = document.getElementById('discountRow');
    var sumDiscount = document.getElementById('sumDiscount');
    
    if (sumEquip) sumEquip.textContent = eqTotal.toLocaleString('ru-RU') + ' ₽';
    if (sumEquip2) sumEquip2.textContent = eqTotal.toLocaleString('ru-RU') + ' ₽';
    if (sumSvc) sumSvc.textContent = svcTotal.toLocaleString('ru-RU') + ' ₽';
    if (sumSvc2) sumSvc2.textContent = svcTotal.toLocaleString('ru-RU') + ' ₽';
    if (sumPiping) sumPiping.textContent = pipingPrice.toLocaleString('ru-RU') + ' ₽';
    if (sumTotal) sumTotal.textContent = total.toLocaleString('ru-RU') + ' ₽';
    if (sumTotal2) sumTotal2.textContent = total.toLocaleString('ru-RU') + ' ₽';
    
    if (discountRow) {
      discountRow.classList.toggle('hidden', discAmt === 0);
      if (sumDiscount) sumDiscount.textContent = '-' + discAmt.toLocaleString('ru-RU') + ' ₽';
    }
  }

  // === АНАЛИЗ ===
  function checkAnalysis() {
    document.querySelectorAll('.analysis-box').forEach(function(box) {
      var input = box.querySelector('input[data-norm]');
      if (input) {
        var val = parseFloat(input.value) || 0;
        var norm = parseFloat(input.dataset.norm) || 0;
        box.classList.toggle('exceeded', val > norm);
      }
    });
  }

  // === ФАЙЛЫ ===
  function setupFilePreview(inputId, previewId, isSingle) {
    var input = document.getElementById(inputId);
    if (!input) return;
    
    input.onchange = function() {
      var preview = document.getElementById(previewId);
      if (!preview) return;
      
      if (isSingle) {
        var img = preview.querySelector('img');
        if (input.files[0]) {
          var reader = new FileReader();
          reader.onload = function(e) {
            img.src = e.target.result;
            preview.classList.remove('hidden');
          };
          reader.readAsDataURL(input.files[0]);
        }
      } else {
        preview.innerHTML = '';
        Array.from(input.files).slice(0, 3).forEach(function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            var img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
          };
          reader.readAsDataURL(file);
        });
      }
    };
  }

  // === ИНИЦИАЛИЗАЦИЯ ===
  document.addEventListener('DOMContentLoaded', function() {
    // Навигация
    var btnNext = document.getElementById('btnNext');
    var btnPrev = document.getElementById('btnPrev');
    if (btnNext) btnNext.onclick = function(e) { e.preventDefault(); showStep(step + 1); };
    if (btnPrev) btnPrev.onclick = function(e) { e.preventDefault(); showStep(step - 1); };
    
    document.querySelectorAll('.step-dot').forEach(function(dot) {
      dot.onclick = function() { showStep(parseInt(dot.dataset.step)); };
    });
    
    // Клиенты
    document.querySelectorAll('input[name="clientType"]').forEach(function(r) { r.onchange = toggleClientType; });
    var cs = document.getElementById('clientSearch');
    if (cs) cs.oninput = filterClients;
    document.querySelectorAll('.client-card').forEach(function(c) { c.onclick = function() { selectClient(c); }; });
    
    // Каталог
    var openBtn = document.getElementById('openCatalogBtn');
    var openBtn2 = document.getElementById('openCatalogBtn2');
    if (openBtn) openBtn.onclick = function(e) { e.preventDefault(); openCatalog(); };
    if (openBtn2) openBtn2.onclick = function(e) { e.preventDefault(); openCatalog(); };
    
    var closeBtn = document.getElementById('closeCatalogBtn');
    var overlay = document.getElementById('catalogOverlay');
    if (closeBtn) closeBtn.onclick = closeCatalog;
    if (overlay) overlay.onclick = closeCatalog;
    
    var catalogSearchInput = document.getElementById('catalogSearch');
    if (catalogSearchInput) catalogSearchInput.oninput = filterCatalog;
    
    // Добавить вручную
    var addBtn = document.getElementById('addItemBtn');
    var addBtn2 = document.getElementById('addItemBtn2');
    if (addBtn) addBtn.onclick = function(e) { e.preventDefault(); addItem({}, 'itemsContainer'); };
    if (addBtn2) addBtn2.onclick = function(e) { e.preventDefault(); addItem({}, 'itemsContainer2'); };
    
    // Обвязка
    document.querySelectorAll('.piping-card').forEach(function(c) {
      c.onclick = function() { selectPiping(c); };
      var priceInput = c.querySelector('.piping-price');
      if (priceInput) {
        priceInput.oninput = function() {
          if (c.classList.contains('selected')) {
            pipingPrice = parseFloat(priceInput.value) || 0;
            document.getElementById('pipingPriceInput').value = pipingPrice;
            calcTotals();
          }
        };
      }
    });
    
    // Услуги
    document.querySelectorAll('.service-cb').forEach(function(cb) { cb.onchange = calcTotals; });
    document.querySelectorAll('.service-price').forEach(function(p) { p.oninput = calcTotals; });
    
    // Скидка
    var discountInput = document.getElementById('discountInput');
    if (discountInput) discountInput.oninput = calcTotals;
    
    // Анализ
    document.querySelectorAll('.analysis-input').forEach(function(inp) { inp.oninput = checkAnalysis; });
    
    // Файлы
    setupFilePreview('schemaInput', 'schemaPreview', true);
    setupFilePreview('workPhotosInput', 'workPhotosPreview', false);
    
    // Выбор из библиотеки
    document.querySelectorAll('.scheme-thumb').forEach(function(t) {
      t.onclick = function() {
        document.querySelectorAll('.scheme-thumb').forEach(function(x) { x.classList.remove('selected'); });
        t.classList.add('selected');
        document.getElementById('schemaImageInput').value = t.dataset.src;
        var preview = document.getElementById('schemaPreview');
        var img = document.getElementById('schemaPreviewImg');
        if (img && preview) {
          img.src = t.dataset.src;
          preview.classList.remove('hidden');
        }
      };
    });
    
    // Добавить начальный товар
    var container = document.getElementById('itemsContainer') || document.getElementById('itemsContainer2');
    if (container && !container.children.length) addItem({});
    
    calcTotals();
  });
})();
