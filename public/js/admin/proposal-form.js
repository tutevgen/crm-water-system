/**
 * proposal-form.js — Форма создания/редактирования КП
 * Исправления: каталог работает, категории, пустые строки убраны,
 * премиум-форма идентична стандартной, поиск работает
 */
(function () {
  'use strict';

  var cfg       = window._proposalCfg || {};
  var PRODUCTS  = cfg.products || [];
  var IS_INSTALL= cfg.isInstall;
  var EDIT_MODE = cfg.editMode;

  var ITEM_CATS = [
    'Аэрация','Обезжелезивание','Умягчение',
    'Механическая очистка','Обратный осмос',
    'УФ-обеззараживание','Другое'
  ];

  // Режим каталога: 'main' | 'premium'
  window._catalogMode = 'main';

  /* ─── Утилиты ─── */
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(n){ return (Number(n)||0).toLocaleString('ru-RU'); }
  function getImg(d){ return d.image||(Array.isArray(d.images)&&d.images[0])||''; }

  /* ─── HTML select категорий ─── */
  function catOptions(selected){
    return '<option value="">— категория —</option>'+
      ITEM_CATS.map(function(c){
        return '<option value="'+esc(c)+'" '+(selected===c?'selected':'')+'>'+esc(c)+'</option>';
      }).join('');
  }

  /* ─── Создать строку оборудования ─── */
  function makeRow(prefix, data, isPremium){
    data = data || {};
    var img  = getImg(data);
    var name = prefix+'[][name]';
    var cat  = prefix+'[][category]';
    var desc = prefix+'[][description]';
    var pid  = prefix+'[][productId]';
    var sku  = prefix+'[][sku]';
    var pimg = prefix+'[][image]';
    var qty  = prefix+'[][quantity]';
    var prc  = prefix+'[][price]';

    var borderCls  = isPremium ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white';
    var inputCls   = isPremium ? 'border-amber-200 bg-white' : 'border-gray-200';
    var numBg      = isPremium ? '#92400e' : '#111827';

    var row = document.createElement('div');
    row.className = 'item-row flex items-start gap-2 p-2.5 border rounded-xl '+borderCls;
    row.dataset.prefix = prefix;

    row.innerHTML =
      // Номер
      '<div class="item-num w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-1" style="background:'+numBg+'">?</div>'+

      // Картинка
      '<div class="eq-img-box w-12 h-12 rounded-lg border '+inputCls+' flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer" title="Нажмите чтобы изменить фото">'+
        (img ? '<img src="'+esc(img)+'" class="w-full h-full object-contain">' : '<span class="text-gray-300 text-lg">📦</span>')+
      '</div>'+

      // Основные поля
      '<div class="flex-1 min-w-0 grid grid-cols-1 gap-1.5">'+
        // Строка 1: категория + название
        '<div class="flex gap-1.5">'+
          '<select name="'+cat+'" class="eq-cat w-36 flex-shrink-0 px-2 py-1.5 border '+inputCls+' rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-400">'+catOptions(data.category||'')+'</select>'+
          '<input type="text" name="'+name+'" value="'+esc(data.name||'')+'" placeholder="Наименование *" required class="item-name flex-1 px-2 py-1.5 border '+inputCls+' rounded-lg text-sm focus:ring-1 focus:ring-blue-400">'+
        '</div>'+
        // Строка 2: описание
        '<input type="text" name="'+desc+'" value="'+esc(data.description||'')+'" placeholder="Краткое описание (для КП)" class="eq-desc w-full px-2 py-1.5 border '+inputCls+' rounded-lg text-xs text-gray-500 bg-white/80 focus:ring-1 focus:ring-blue-400">'+
      '</div>'+

      // Скрытые поля
      '<input type="hidden" name="'+pid+'" value="'+esc(data.productId||'')+'">'+
      '<input type="hidden" name="'+sku+'" value="'+esc(data.sku||'')+'">'+
      '<input type="hidden" name="'+pimg+'" class="eq-img-hidden" value="'+esc(img)+'">'+

      // Кол-во
      '<div class="flex flex-col items-center gap-0.5 flex-shrink-0">'+
        '<span class="text-xs text-gray-400">Кол-во</span>'+
        '<input type="number" name="'+qty+'" value="'+(parseInt(data.quantity)||1)+'" min="1" class="item-qty w-14 px-2 py-1.5 border '+inputCls+' rounded-lg text-sm text-center">'+
      '</div>'+

      // Цена
      '<div class="flex flex-col items-end gap-0.5 flex-shrink-0">'+
        '<span class="text-xs text-gray-400">Цена ₽</span>'+
        '<input type="number" name="'+prc+'" value="'+(parseFloat(data.price)||0)+'" min="0" class="item-price w-28 px-2 py-1.5 border '+inputCls+' rounded-lg text-sm text-right">'+
      '</div>'+

      // Сумма
      '<div class="flex flex-col items-end gap-0.5 flex-shrink-0">'+
        '<span class="text-xs text-gray-400">Сумма</span>'+
        '<div class="item-sum w-28 py-1.5 text-sm font-bold text-right text-gray-800">0 ₽</div>'+
      '</div>'+

      // Удалить
      '<button type="button" class="item-del p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0 mt-1">'+
        '<i data-lucide="x" class="w-4 h-4"></i>'+
      '</button>';

    return row;
  }

  /* ─── Добавить позицию в основной список ─── */
  function addItem(data){
    var c = document.getElementById('itemsContainer');
    if(!c) return;
    var row = makeRow('items', data, false);
    c.appendChild(row);
    wireRow(row, 'main');
    renumber();
    recalculate();
    // Скрыть hint
    var hint = document.getElementById('emptyEquipHint');
    if(hint) hint.classList.add('hidden');
    if(typeof lucide!=='undefined') lucide.createIcons();
  }

  /* ─── Добавить позицию в премиум ─── */
  function addPremiumItem(data){
    var c = document.getElementById('premiumItemsContainer');
    if(!c) return;
    var row = makeRow('premiumItems', data, true);
    c.appendChild(row);
    wireRow(row, 'premium');
    renumberContainer(c, true);
    recalcPremium();
    // Скрыть hint
    var hint = document.getElementById('emptyPremiumHint');
    if(hint) hint.classList.add('hidden');
    if(typeof lucide!=='undefined') lucide.createIcons();
  }
  window._addPremiumItem = addPremiumItem;

  /* ─── Навешать обработчики на строку ─── */
  function wireRow(row, mode){
    var isPrem = mode==='premium';

    // Удаление
    row.querySelector('.item-del').onclick = function(){
      row.remove();
      if(isPrem){
        var prc = document.getElementById('premiumItemsContainer');
        renumberContainer(prc, true);
        recalcPremium();
        var hint = document.getElementById('emptyPremiumHint');
        if(hint && prc && !prc.querySelector('.item-row')) hint.classList.remove('hidden');
      } else {
        renumber();
        recalculate();
        var c   = document.getElementById('itemsContainer');
        var hint = document.getElementById('emptyEquipHint');
        if(hint && c && !c.querySelector('.item-row')) hint.classList.remove('hidden');
      }
    };

    // Пересчёт
    row.querySelector('.item-qty').oninput   = isPrem ? recalcPremium : recalculate;
    row.querySelector('.item-price').oninput = isPrem ? recalcPremium : recalculate;

    // Клик по картинке — загрузить файл
    var imgBox = row.querySelector('.eq-img-box');
    var hidden  = row.querySelector('.eq-img-hidden');
    if(imgBox && hidden){
      imgBox.addEventListener('click', function(){
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = function(){
          var file = inp.files[0];
          if(!file) return;
          var reader = new FileReader();
          reader.onload = function(e){
            hidden.value = e.target.result; // base64 — для отображения
            imgBox.innerHTML = '<img src="'+e.target.result+'" class="w-full h-full object-contain">';
          };
          reader.readAsDataURL(file);
        };
        inp.click();
      });
    }
  }

  /* ─── Нумерация ─── */
  function renumber(){
    document.querySelectorAll('#itemsContainer .item-row').forEach(function(r,i){
      var n = r.querySelector('.item-num'); if(n) n.textContent=i+1;
    });
  }
  function renumberContainer(c, isPrem){
    (c||document).querySelectorAll('.item-row').forEach(function(r,i){
      var n = r.querySelector('.item-num'); if(n) n.textContent=i+1;
    });
  }

  /* ─── Расчёт ОСНОВНОГО ─── */
  function recalculate(){
    var eqTotal=0;
    document.querySelectorAll('#itemsContainer .item-row').forEach(function(row){
      var q=parseFloat(row.querySelector('.item-qty')?.value)||0;
      var p=parseFloat(row.querySelector('.item-price')?.value)||0;
      var s=q*p; eqTotal+=s;
      var sd=row.querySelector('.item-sum'); if(sd) sd.textContent=fmt(s)+' ₽';
    });
    var pip  = parseFloat(document.getElementById('pipingPriceInput')?.value)||0;
    var svc  = 0;
    document.querySelectorAll('.service-cb:checked').forEach(function(cb){
      var row = cb.closest('label');
      var sp  = row?.querySelector('.service-price');
      if(sp) svc += parseFloat(sp.value)||0;
    });
    var clientDisc= parseFloat(document.getElementById('clientDiscountInput')?.value)||0;
    var mgrDisc   = parseFloat(document.getElementById('discountInput')?.value)||0;
    var sub  = eqTotal+pip+svc;
    var cda  = sub*clientDisc/100;
    var after= sub-cda;
    var da   = after*mgrDisc/100;
    var total= after-da;

    // Мини-итого
    var el=document.getElementById('equipmentTotal'); if(el) el.textContent=fmt(eqTotal)+' ₽';
    var pl=document.getElementById('pipingTotal');    if(pl) pl.textContent=fmt(pip)+' ₽';
    var sl=document.getElementById('servicesTotal');  if(sl) sl.textContent=fmt(svc)+' ₽';
    var bl=document.getElementById('subtotal');       if(bl) bl.textContent=fmt(sub)+' ₽';
    // Правая панель
    var se=document.getElementById('sumEq');  if(se) se.textContent=fmt(eqTotal)+' ₽';
    var sp=document.getElementById('sumPip'); if(sp) sp.textContent=fmt(pip)+' ₽';
    var ss=document.getElementById('sumSv');  if(ss) ss.textContent=fmt(svc)+' ₽';
    var cdRow=document.getElementById('clientDiscountRow');
    var cdAmt=document.getElementById('clientDiscountAmount');
    if(clientDisc>0){ if(cdRow) cdRow.classList.remove('hidden'); if(cdAmt) cdAmt.textContent='-'+fmt(cda)+' ₽'; }
    else             { if(cdRow) cdRow.classList.add('hidden'); }
    var dr=document.getElementById('discRow');
    var da2=document.getElementById('discountAmount');
    if(mgrDisc>0){ if(dr) dr.classList.remove('hidden'); if(da2) da2.textContent='-'+fmt(da)+' ₽'; }
    else          { if(dr) dr.classList.add('hidden'); }
    var tot=document.getElementById('sumTot'); if(tot) tot.textContent=fmt(total)+' ₽';
  }

  /* ─── Расчёт ПРЕМИУМ ─── */
  function recalcPremium(){
    var total=0;
    document.querySelectorAll('#premiumItemsContainer .item-row').forEach(function(row){
      var q=parseFloat(row.querySelector('.item-qty')?.value)||0;
      var p=parseFloat(row.querySelector('.item-price')?.value)||0;
      var s=q*p; total+=s;
      var sd=row.querySelector('.item-sum'); if(sd) sd.textContent=fmt(s)+' ₽';
    });
    var pip  = parseFloat(document.querySelector('input[name="premiumPipingPrice"]')?.value)||0;
    var svc  = parseFloat(document.getElementById('premiumServicesTotalInput')?.value)||0;
    var grand= total+pip+svc;
    var disp = document.getElementById('premiumTotalDisplay'); if(disp) disp.textContent=fmt(grand)+' ₽';
  }
  window._recalcPremium = recalcPremium;

  /* ─── КАТАЛОГ ─── */
  function openCatalog(mode){
    window._catalogMode = mode||'main';
    var title = document.getElementById('catalogTitle');
    if(title) title.textContent = mode==='premium' ? '👑 Каталог — Премиум' : 'Каталог товаров';
    document.getElementById('catalogModal').classList.remove('hidden');
    var searchEl = document.getElementById('catalogSearch');
    if(searchEl) searchEl.value = '';

    if(PRODUCTS.length > 0){
      renderCatalog(PRODUCTS);
    } else {
      // Загрузить все товары через API
      var grid = document.getElementById('catalogGrid');
      if(grid) grid.innerHTML = '<div class="col-span-4 text-center py-10 text-gray-400 text-sm">⏳ Загрузка товаров...</div>';
      fetch('/admin/proposals/api/products?limit=200')
        .then(function(r){ return r.json(); })
        .then(function(data){
          if(data.success && data.products && data.products.length > 0){
            // Кешируем в PRODUCTS для последующего поиска
            data.products.forEach(function(p){ PRODUCTS.push(p); });
            renderCatalog(PRODUCTS);
          } else {
            if(grid) grid.innerHTML = '<div class="col-span-4 text-center py-10 text-gray-400 text-sm">Товаров нет в базе данных</div>';
          }
        })
        .catch(function(err){
          console.error('Catalog load error:', err);
          if(grid) grid.innerHTML = '<div class="col-span-4 text-center py-10 text-red-400 text-sm">Ошибка загрузки каталога</div>';
        });
    }
  }

  function closeCatalog(){
    document.getElementById('catalogModal').classList.add('hidden');
    window._catalogMode = 'main';
    var title = document.getElementById('catalogTitle');
    if(title) title.textContent = 'Каталог товаров';
  }

  // Debounce timer для API поиска
  var _searchTimer = null;

  function filterCatalog(){
    var q = (document.getElementById('catalogSearch')?.value||'').toLowerCase().trim();

    // Если товары уже загружены — фильтруем локально
    if(PRODUCTS.length > 0){
      if(!q){ renderCatalog(PRODUCTS); return; }
      renderCatalog(PRODUCTS.filter(function(p){
        return (p.name||'').toLowerCase().includes(q)||
               (p.sku||'').toLowerCase().includes(q)||
               (p.description||'').toLowerCase().includes(q);
      }));
      return;
    }

    // Иначе — live-поиск через API
    clearTimeout(_searchTimer);
    var grid = document.getElementById('catalogGrid');
    if(grid) grid.innerHTML = '<div class="col-span-4 text-center py-8 text-gray-400 text-sm">⏳ Поиск...</div>';

    _searchTimer = setTimeout(function(){
      var url = '/admin/proposals/api/products' + (q ? '?q='+encodeURIComponent(q) : '');
      fetch(url)
        .then(function(r){ return r.json(); })
        .then(function(data){
          if(data.success && data.products){
            // Сохраняем в PRODUCTS чтобы click handler мог найти товар
            PRODUCTS.length = 0;
            data.products.forEach(function(p){ PRODUCTS.push(p); });
            renderCatalog(PRODUCTS);
          }
        })
        .catch(function(){
          if(grid) grid.innerHTML = '<div class="col-span-4 text-center py-8 text-red-400 text-sm">Ошибка загрузки</div>';
        });
    }, 300);
  }

  function renderCatalog(list){
    var grid = document.getElementById('catalogGrid');
    if(!grid) return;
    if(!list.length){
      grid.innerHTML='<div class="col-span-4 text-center py-10 text-gray-400 text-sm">Товары не найдены</div>';
      return;
    }
    grid.innerHTML = list.map(function(p){
      var img = getImg(p);
      var catName = p.category && typeof p.category === 'object' ? (p.category.name||'') : (p.category||'');
      return '<div class="product-item border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all flex flex-col items-center gap-1.5" data-id="'+esc(p._id)+'">'+
        '<div class="w-full h-16 flex items-center justify-center mb-1">'+
          (img?'<img src="'+esc(img)+'" class="max-h-full max-w-full object-contain">':'<span class="text-3xl">📦</span>')+
        '</div>'+
        '<div class="text-xs font-semibold text-center text-gray-800 leading-tight w-full truncate">'+esc(p.name)+'</div>'+
        (p.sku?'<div class="text-xs text-gray-400">'+esc(p.sku)+'</div>':'')+
        (catName?'<div class="text-xs text-gray-300 truncate w-full text-center">'+esc(catName)+'</div>':'')+
        '<div class="text-sm font-bold text-blue-600 mt-auto">'+fmt(p.price)+' ₽</div>'+
      '</div>';
    }).join('');

    grid.querySelectorAll('.product-item').forEach(function(el){
      el.onclick = function(){
        var prod = PRODUCTS.find(function(x){ return x._id===el.dataset.id; });
        if(prod){
          // 1. Приоритет: поле proposalCategory из карточки товара
          // 2. Если не задано: точное совпадение названия категории с ITEM_CATS
          // 3. Иначе: пусто
          var mappedCat = '';
          if(prod.proposalCategory && ITEM_CATS.indexOf(prod.proposalCategory) !== -1){
            mappedCat = prod.proposalCategory;
          } else if(prod.category){
            var prodCatName = typeof prod.category === 'object'
              ? (prod.category.name || '')
              : String(prod.category);
            if(ITEM_CATS.indexOf(prodCatName) !== -1){
              mappedCat = prodCatName;
            }
          }
          console.log('[Каталог] Товар:', prod.name, '| proposalCategory:', prod.proposalCategory, '| category:', prod.category, '| mappedCat:', mappedCat);
          var itemData = {
            productId:   prod._id,
            name:        prod.name,
            sku:         prod.sku||'',
            price:       prod.price,
            image:       getImg(prod),
            quantity:    1,
            description: prod.description||prod.shortDescription||'',
            category:    mappedCat
          };
          if(window._catalogMode==='premium'){
            addPremiumItem(itemData);
          } else {
            addItem(itemData);
          }
        }
        closeCatalog();
      };
    });
  }

  /* ─── Обвязка (пайпинг) ─── */
  function setupPiping(){
    document.querySelectorAll('.piping-card').forEach(function(card){
      card.addEventListener('click',function(){
        document.querySelectorAll('.piping-card').forEach(function(c){ c.classList.remove('selected'); c.querySelector('input[type=radio]').checked=false; });
        card.classList.add('selected');
        card.querySelector('input[type=radio]').checked=true;
        var priceInp = card.querySelector('.piping-price');
        var hidden   = document.getElementById('pipingPriceInput');
        if(priceInp && hidden) hidden.value = priceInp.value||0;
        recalculate();
      });
      card.querySelector('.piping-price')?.addEventListener('input',function(){
        if(card.classList.contains('selected')){
          var hidden = document.getElementById('pipingPriceInput');
          if(hidden) hidden.value = this.value||0;
          recalculate();
        }
      });
    });
  }

  /* ─── Клиент ─── */
  function setupClientSearch(){
    var inp = document.getElementById('clientSearch');
    if(!inp) return;
    inp.addEventListener('input',function(){
      var q = inp.value.toLowerCase();
      document.querySelectorAll('.client-card').forEach(function(card){
        var name  = card.dataset.name||'';
        var phone = card.dataset.phone||'';
        card.style.display = (!q||name.includes(q)||phone.includes(q)) ? '' : 'none';
      });
    });
    document.querySelectorAll('.client-card').forEach(function(card){
      card.addEventListener('click',function(){
        var radio = card.querySelector('input[type=radio]');
        if(radio){ radio.checked=true; }
        document.querySelectorAll('.client-card').forEach(function(c){ c.classList.remove('selected'); });
        card.classList.add('selected');
        var disc = card.dataset.discount||0;
        var discInp = document.getElementById('clientDiscountInput');
        if(discInp){ discInp.value=disc; }
        recalculate();
      });
    });
    document.querySelectorAll('input[name="clientType"]').forEach(function(r){
      r.addEventListener('change',function(){
        var isNew = this.value==='new';
        document.getElementById('existingClientSection').classList.toggle('hidden',isNew);
        document.getElementById('newClientSection').classList.toggle('hidden',!isNew);
      });
    });
  }

  /* ─── Адрес из поля клиента ─── */
  function setupAddressAutofill(){
    document.querySelectorAll('.client-card').forEach(function(card){
      card.addEventListener('click',function(){
        var addr = card.dataset.address||'';
        var addrInp = document.getElementById('addressInput');
        if(addrInp && !addrInp.value && addr) addrInp.value = addr;
      });
    });
  }

  /* ─── Схема (schema image) ─── */
  function setupSchema(){
    var inp = document.getElementById('schemaInput');
    var hidden = document.getElementById('schemaImageHidden');
    var preview = document.getElementById('schemaPreview');
    var img = document.getElementById('schemaImg');
    if(inp){ inp.addEventListener('change',function(){
      var file = inp.files[0]; if(!file) return;
      var reader=new FileReader();
      reader.onload=function(e){ if(img) img.src=e.target.result; if(preview) preview.classList.remove('hidden'); };
      reader.readAsDataURL(file);
    }); }
    document.querySelectorAll('.scheme-thumb').forEach(function(th){
      th.addEventListener('click',function(){
        var src=th.dataset.src;
        if(hidden) hidden.value=src;
        if(img) img.src=src; if(preview) preview.classList.remove('hidden');
        document.querySelectorAll('.scheme-thumb').forEach(function(t){ t.style.borderColor='transparent'; });
        th.style.borderColor='#2563eb';
      });
    });
  }

  /* ─── Фото работ ─── */
  function setupWorkPhotos(){
    var selectedPhotos = (window._proposalCfg?.selectedPhotos)||[];
    document.querySelectorAll('.photo-thumb').forEach(function(th){
      var src = th.dataset.src;
      th.addEventListener('click',function(){
        var idx = selectedPhotos.indexOf(src);
        if(idx>-1){ selectedPhotos.splice(idx,1); th.style.borderColor='transparent'; }
        else       { if(selectedPhotos.length<5){ selectedPhotos.push(src); th.style.borderColor='#2563eb'; } }
      });
    });
    document.getElementById('workPhotosInput')?.addEventListener('change',function(){
      var preview = document.getElementById('workPhotosPreview');
      if(!preview) return;
      Array.from(this.files).slice(0,5-selectedPhotos.length).forEach(function(file){
        var reader=new FileReader();
        reader.onload=function(e){ var i=document.createElement('img'); i.src=e.target.result; i.className='w-16 h-16 object-cover rounded border border-gray-200'; preview.appendChild(i); };
        reader.readAsDataURL(file);
      });
    });
  }

  /* ─── Анализ воды ─── */
  function setupAnalysis(){
    document.querySelectorAll('.analysis-input').forEach(function(inp){
      var norm = parseFloat(inp.dataset.norm);
      inp.addEventListener('input',function(){
        var card=inp.closest('.analysis-card');
        if(!card||isNaN(norm)) return;
        card.classList.toggle('exceeded', parseFloat(inp.value)>norm);
      });
    });
  }

  /* ─── Степпер ─── */
  function setupStepper(){
    var totalSteps = window._proposalCfg?.totalSteps||4;
    var currentStep = 1;
    function goStep(n){
      if(n<1||n>totalSteps) return;
      currentStep=n;
      for(var i=1;i<=totalSteps;i++){
        var sc=document.getElementById('step'+i); if(sc) sc.classList.toggle('active',i===n);
        var dot=document.querySelector('.step-dot[data-step="'+i+'"]');
        if(dot){
          dot.classList.toggle('active',i===n);
          dot.classList.toggle('done',i<n);
        }
        var line=document.querySelectorAll('.step-line')[i-1];
        if(line) line.classList.toggle('done',i<n);
        var lbl=document.querySelectorAll('.step-label')[i-1];
        if(lbl){ lbl.className='step-label text-xs '+(i===n?'text-blue-600 font-medium':i<n?'text-green-600':'text-gray-400'); }
      }
      var prev=document.getElementById('btnPrev');
      var next=document.getElementById('btnNext');
      var sub=document.getElementById('btnSubmit');
      if(prev) prev.classList.toggle('hidden',n===1);
      if(next) next.classList.toggle('hidden',n===totalSteps);
      if(sub)  sub.classList.toggle('hidden',n!==totalSteps);
    }
    window.goStep=goStep;
    document.getElementById('btnNext')?.addEventListener('click',function(){ goStep(currentStep+1); });
    document.getElementById('btnPrev')?.addEventListener('click',function(){ goStep(currentStep-1); });
    document.querySelectorAll('.step-dot').forEach(function(dot){
      dot.addEventListener('click',function(){ goStep(parseInt(dot.dataset.step)||1); });
    });
  }

  /* ─── Сервисы ─── */
  function setupServices(){
    document.querySelectorAll('.service-cb').forEach(function(cb){
      cb.addEventListener('change',recalculate);
    });
    document.querySelectorAll('.service-price').forEach(function(inp){
      inp.addEventListener('input',recalculate);
    });
  }

  /* ─── Скидка менеджера ─── */
  function setupDiscount(){
    document.getElementById('discountInput')?.addEventListener('input',recalculate);
  }

  /* ─── Каталог события ─── */
  function setupCatalog(){
    document.getElementById('openCatalogBtn')?.addEventListener('click',function(){ openCatalog('main'); });
    document.getElementById('openPremiumCatalogBtn')?.addEventListener('click',function(){ openCatalog('premium'); });
    document.getElementById('closeCatalogBtn')?.addEventListener('click',closeCatalog);
    document.getElementById('catalogSearch')?.addEventListener('input',filterCatalog);
    document.getElementById('addItemBtn')?.addEventListener('click',function(){ addItem({}); });
    document.getElementById('addPremiumItemBtn')?.addEventListener('click',function(){ addPremiumItem({}); });
    // Закрытие по фону
    document.getElementById('catalogModal')?.addEventListener('click',function(e){ if(e.target===this) closeCatalog(); });
  }

  /* ─── Премиум обвязка и монтаж ─── */
  function setupPremium(){
    document.querySelector('input[name="premiumPipingPrice"]')?.addEventListener('input',recalcPremium);
    document.getElementById('premiumServicesTotalInput')?.addEventListener('input',recalcPremium);
  }

  /* ─── Восстановить существующие строки (edit mode) ─── */
  function wireExistingRows(){
    document.querySelectorAll('#itemsContainer .item-row').forEach(function(row){
      row.querySelector('.item-del')?.addEventListener('click',function(){ row.remove(); renumber(); recalculate(); });
      row.querySelector('.item-qty')?.addEventListener('input',recalculate);
      row.querySelector('.item-price')?.addEventListener('input',recalculate);
    });
    document.querySelectorAll('#premiumItemsContainer .item-row').forEach(function(row){
      row.querySelector('.item-del')?.addEventListener('click',function(){ row.remove(); renumberContainer(document.getElementById('premiumItemsContainer'),true); recalcPremium(); });
      row.querySelector('.item-qty')?.addEventListener('input',recalcPremium);
      row.querySelector('.item-price')?.addEventListener('input',recalcPremium);
    });
  }

  /* ─── Сабмит ─── */
  function setupSubmit(){
    document.getElementById('btnSubmit')?.addEventListener('click',function(){
      if(IS_INSTALL && document.querySelectorAll('#itemsContainer .item-row').length===0){
        alert('Добавьте хотя бы одну позицию оборудования');
        goStep(IS_INSTALL?3:2);
        return;
      }
      document.getElementById('proposalForm')?.submit();
    });
  }

  /* ─── INIT ─── */
  document.addEventListener('DOMContentLoaded',function(){
    setupStepper();
    setupClientSearch();
    setupAddressAutofill();
    setupAnalysis();
    setupPiping();
    setupServices();
    setupDiscount();
    setupSchema();
    setupWorkPhotos();
    setupCatalog();
    setupPremium();
    wireExistingRows();
    setupSubmit();
    // НЕ добавляем пустую строку при создании — только по кнопке
    recalculate();
    recalcPremium();
    if(typeof lucide!=='undefined') lucide.createIcons();
  });

})();
