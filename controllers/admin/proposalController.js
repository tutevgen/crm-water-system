const { escapeRegex } = require("../../utils/helpers");
/**
 * Контроллер коммерческих предложений
 */
const Proposal = require('../../models/Proposal');
const User = require('../../models/User');
const Product = require('../../models/admin/Product');
const CompanyDetails = require('../../models/CompanyDetails');
const { AppError } = require('../../middleware/errorHandler');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// FIX #13: единый транспорт для отправки писем
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// Настройки компании
const COMPANY_INFO = {
  name:     'Нова Фильтр',
  fullName: 'ООО "Нова Фильтр"',
  slogan:   'Чистая вода для вашего дома',
  phone:    '8 966-199-97-63',
  email:    'info@nova-filter.ru',
  website:  'www.nova-filter.ru',
  address:  '',
  inn:      '7622019627',
  kpp:      '762201001',
  ogrn:     '',
  bank:     'Альфа-Банк'
};

// Рекомендуемые опции
const RECOMMENDED_OPTIONS = {
  'uv_sterilizer': { name: 'УФ-стерилизатор', price: 12500, description: 'Обеззараживание воды' },
  'leak_protection': { name: 'Защита от протечек', price: 8500, description: 'Автоматическое отключение' },
  'thermal_cover': { name: 'Термочехол', price: 4500, description: 'Защита от перепадов температуры' },
  'ro_system': { name: 'Обратный осмос', price: 18900, description: 'Питьевая вода высшего качества' },
  'bypass': { name: 'Байпас', price: 3200, description: 'Обход системы при обслуживании' }
};

// Материалы обвязки
const PIPING_MATERIALS = {
  'polypropylene': { name: 'Полипропилен', basePrice: 8000 },
  'metal_plastic': { name: 'Металлопластик', basePrice: 10000 },
  'stainless': { name: 'Нержавеющая сталь', basePrice: 15000 },
  'copper': { name: 'Медь', basePrice: 18000 }
};

/**
 * Парсинг позиций оборудования
 */
function parseItems(items, body) {
  const parsedItems = [];

  // Формат 1: items[][name] (из HTML-формы с EJS)
  const flatName = body?.['items[][name]'];
  const flatPrice = body?.['items[][price]'];

  if (flatName !== undefined) {
    const names       = Array.isArray(flatName)  ? flatName  : [flatName];
    const prices      = Array.isArray(flatPrice) ? flatPrice : [flatPrice];
    const toArr = (v) => Array.isArray(v) ? v : (v !== undefined ? [v] : []);

    const qtyArr  = toArr(body['items[][quantity]']);
    const idArr   = toArr(body['items[][productId]']);
    const skuArr  = toArr(body['items[][sku]']);
    const descArr = toArr(body['items[][description]']);
    const imgArr  = toArr(body['items[][image]']);
    const catArr  = toArr(body['items[][category]']); // FIX: category

    for (let i = 0; i < names.length; i++) {
      const name  = names[i];
      const price = prices[i];
      if (name && String(name).trim()) {
        parsedItems.push({
          productId:   idArr[i]   || null,
          sku:         skuArr[i]  || '',
          name:        String(name).trim(),
          description: descArr[i] || '',
          image:       imgArr[i]  || '',
          category:    catArr[i]  || '',   // FIX
          quantity:    parseFloat(qtyArr[i]) || 1,
          unit:        'шт',
          price:       parseFloat(price) || 0,
          discount:    0
        });
      }
    }
    return parsedItems;
  }

  // Формат 2: массив объектов (items[0].name = [...])
  if (Array.isArray(items)) {
    const firstItem = items[0];

    if (firstItem && Array.isArray(firstItem.name)) {
      const names       = firstItem.name        || [];
      const prices      = firstItem.price       || [];
      const quantities  = firstItem.quantity    || [];
      const productIds  = firstItem.productId   || [];
      const skus        = firstItem.sku         || [];
      const descriptions= firstItem.description || [];
      const images      = firstItem.image       || [];
      const categories  = firstItem.category    || []; // FIX

      for (let i = 0; i < names.length; i++) {
        if (names[i] && String(names[i]).trim()) {
          parsedItems.push({
            productId:   productIds[i]   || null,
            sku:         skus[i]         || '',
            name:        String(names[i]).trim(),
            description: descriptions[i] || '',
            image:       images[i]       || '',
            category:    categories[i]   || '',  // FIX
            quantity:    parseFloat(quantities[i]) || 1,
            unit:        'шт',
            price:       parseFloat(prices[i]) || 0,
            discount:    0
          });
        }
      }
    } else {
      // Формат 3: items[i].name (объекты)
      for (const item of items) {
        if (item && item.name && String(item.name).trim()) {
          parsedItems.push({
            productId:   item.productId   || null,
            sku:         item.sku         || '',
            name:        String(item.name).trim(),
            description: item.description || '',
            image:       item.image       || '',
            category:    item.category    || '',  // FIX
            quantity:    parseFloat(item.quantity) || 1,
            unit:        item.unit        || 'шт',
            price:       parseFloat(item.price) || 0,
            discount:    parseFloat(item.discount) || 0
          });
        }
      }
    }
  }

  return parsedItems;
}

/**
 * Парсинг позиций Премиум оборудования
 */
function parsePremiumItems(body) {
  const result = [];
  const toArr = (v) => v === undefined ? [] : (Array.isArray(v) ? v : [v]);

  const names  = toArr(body['premiumItems[][name]']);
  const prices = toArr(body['premiumItems[][price]']);
  if (!names.length) return result;

  const cats   = toArr(body['premiumItems[][category]']);
  const descs  = toArr(body['premiumItems[][description]']);
  const imgs   = toArr(body['premiumItems[][image]']);
  const ids    = toArr(body['premiumItems[][productId]']);
  const qtys   = toArr(body['premiumItems[][quantity]']);

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!name || !String(name).trim()) continue;
    result.push({
      productId:   ids[i]   || null,
      name:        String(name).trim(),
      description: descs[i] || '',
      image:       imgs[i]  || '',
      category:    cats[i]  || '',
      quantity:    parseInt(qtys[i])   || 1,
      unit:        'шт',
      price:       parseFloat(prices[i]) || 0
    });
  }
  return result;
}

/**
 * Список всех КП
 */
exports.index = async (req, res, next) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    const user = req.session.user;
    
    const filter = {};
    if (user.role === 'client') {
      filter.clientId = user._id;
    } else if (user.role === 'manager') {
      filter.managerId = user._id;
    }
    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.proposalType = type;
    if (search) {
      filter.$or = [
        { proposalNumber: new RegExp(escapeRegex(search), 'i') },
        { clientName: new RegExp(escapeRegex(search), 'i') }
      ];
    }
    
    const skip = (page - 1) * limit;
    const [proposals, total] = await Promise.all([
      Proposal.find(filter)
        .populate('clientId', 'name email phone')
        .populate('managerId', 'name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Proposal.countDocuments(filter)
    ]);
    
    await Proposal.checkExpired();
    
    res.render('pages/admin/proposals/proposals', {
      title: 'Коммерческие предложения',
      proposals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: { status, type, search },
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Форма создания КП
 * ИСПРАВЛЕНО: Добавлены recommendedOptions и pipingMaterials
 */
exports.createForm = async (req, res, next) => {
  try {
    const proposalType = req.query.type || 'installation';
    const isInstallation = proposalType === 'installation';
    const isRefill = proposalType === 'refill';
    const isMaintenance = proposalType === 'maintenance';
    const isRepair = proposalType === 'repair';
    
    const [clients, products] = await Promise.all([
      User.find({ role: 'client', isActive: true })
        .select('name email phone discount address')
        .sort({ name: 1 })
        .lean(),
      Product.find({ deletedAt: null })
        .select('name price sku unit category description image images proposalCategory')
        .populate('category', 'name')
        .sort({ 'metadata.sales': -1 })
        .limit(200)
        .lean()
    ]);
    
    // Добавляем изображение к каждому продукту
    const productsWithImages = products.map(p => ({
      ...p,
      image: p.image || (p.images && p.images[0]) || null
    }));
    
    // Загрузка схем из папки
    let schemes = [];
    const schemesDir = path.join(__dirname, '../../public/uploads/schemes');
    try {
      if (fs.existsSync(schemesDir)) {
        schemes = fs.readdirSync(schemesDir)
          .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
          .map(f => '/uploads/schemes/' + f)
          .slice(0, 20);
      }
    } catch (e) { console.log('No schemes dir'); }
    
    // Загрузка фото работ из папки
    let workPhotos = [];
    const worksDir = path.join(__dirname, '../../public/uploads/works');
    try {
      if (fs.existsSync(worksDir)) {
        workPhotos = fs.readdirSync(worksDir)
          .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
          .map(f => '/uploads/works/' + f)
          .slice(0, 20);
      }
    } catch (e) { console.log('No works dir'); }
    
    res.render('pages/admin/proposals/proposal-create', {
      title: isRefill ? 'КП на перезасыпку' : 
             isMaintenance ? 'КП на ТО' :
             isRepair ? 'КП на ремонт' : 'Создать КП',
      clients,
      products: productsWithImages,
      schemes,
      workPhotos,
      proposalType,
      isInstallation,
      isRefill,
      isMaintenance,
      isRepair,
      // ИСПРАВЛЕНО: Добавлены недостающие переменные
      recommendedOptions: RECOMMENDED_OPTIONS,
      pipingMaterials: PIPING_MATERIALS,
      csrfToken: res.locals.csrfToken
    });
    
  } catch (err) {
    console.error('❌ Ошибка загрузки формы:', err);
    next(err);
  }
};

/**
 * Создание КП
 */
exports.create = async (req, res, next) => {
  try {
    const sessionUser = req.session.user;
    // Всегда берём свежие данные менеджера из БД — сессия может быть устаревшей
    const freshMgr = await User.findById(sessionUser._id).select('name phone email avatar').lean();
    const user = Object.assign({}, sessionUser, freshMgr || {});
    // Обновляем сессию на актуальные данные
    if (freshMgr) {
      if (freshMgr.name)  req.session.user.name  = freshMgr.name;
      if (freshMgr.phone) req.session.user.phone = freshMgr.phone;
      if (freshMgr.email) req.session.user.email = freshMgr.email;
    }
    const {
      clientId,
      clientType,
      newClientName,
      newClientPhone,
      newClientEmail,
      proposalType = 'installation',
      objectAddress,
      objectType,
      waterSource,
      residents,
      waterPoints,
      analysis,
      items,
      services,
      discount = '0',
      paymentTerms,
      deliveryTime,
      installationTime,
      validDays,
      warrantyEquipment,
      warrantyInstallation,
      warrantyWater,
      includes,
      notes,
      recommendedOptions,
      optionPrices = {},
      pipingMaterial,
      clientDiscount = '0'
    } = req.body;

    console.log('📝 Создание КП. Данные:', {
      clientType,
      clientId,
      proposalType,
      itemsCount: Array.isArray(items) ? items.length : 0
    });

    // ========== КЛИЕНТ ==========
    let client;
    if (clientType === 'new') {
      if (!newClientName || !newClientPhone) {
        throw new AppError('Укажите имя и телефон клиента', 400);
      }
      const existing = await User.findOne({
        $or: [
          { phone: newClientPhone },
          newClientEmail ? { email: newClientEmail.toLowerCase() } : {}
        ].filter(x => Object.keys(x).length > 0)
      });

      if (existing) {
        client = existing;
      } else {
        // FIX #20: генерируем пароль и сохраняем до хеширования чтобы отправить клиенту
        const tempPassword = Math.random().toString(36).slice(-8) +
                             Math.random().toString(36).slice(-4).toUpperCase();
        client = new User({
          name: newClientName.trim(),
          phone: newClientPhone,
          email: newClientEmail ? newClientEmail.toLowerCase() : null,
          login: newClientPhone,
          isPhone: true,
          password: tempPassword,   // pre-save хук в User.js хеширует это автоматически
          role: 'client',
          isVerified: true,
          isActive: true
        });
        await client.save();

        // Отправляем данные для входа клиенту
        if (newClientEmail) {
          try {
            await transporter.sendMail({
              from: `"${process.env.SMTP_FROM_NAME || 'CRM'}" <${process.env.SMTP_USER}>`,
              to: newClientEmail,
              subject: 'Ваш личный кабинет создан',
              html: `
                <h2>Здравствуйте, ${newClientName}!</h2>
                <p>Менеджер создал для вас личный кабинет. Данные для входа:</p>
                <table style="border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:8px 16px;border:1px solid #e5e7eb"><b>Сайт</b></td>
                      <td style="padding:8px 16px;border:1px solid #e5e7eb">
                        <a href="${process.env.SITE_URL || 'http://localhost:3000'}/login">
                          ${process.env.SITE_URL || 'http://localhost:3000'}/login
                        </a></td></tr>
                  <tr><td style="padding:8px 16px;border:1px solid #e5e7eb"><b>Логин</b></td>
                      <td style="padding:8px 16px;border:1px solid #e5e7eb">${newClientEmail}</td></tr>
                  <tr><td style="padding:8px 16px;border:1px solid #e5e7eb"><b>Пароль</b></td>
                      <td style="padding:8px 16px;border:1px solid #e5e7eb"><b>${tempPassword}</b></td></tr>
                </table>
                <p style="color:#6b7280;font-size:13px">Рекомендуем сменить пароль после первого входа.</p>`
            });
          } catch (mailErr) {
            console.error('⚠️ Не удалось отправить данные для входа клиенту:', mailErr.message);
          }
        }
      }
    } else {
      if (!clientId) throw new AppError('Выберите клиента', 400);
      client = await User.findById(clientId);
      if (!client) throw new AppError('Клиент не найден', 404);
    }

    // ========== ПАРСИНГ ОБОРУДОВАНИЯ ==========
    const parsedItems = parseItems(items, req.body);
    console.log('📦 Распарсено позиций:', parsedItems.length);
    
    if (parsedItems.length === 0) {
      throw new AppError('Добавьте хотя бы одну позицию оборудования', 400);
    }

    // ========== УСЛУГИ ==========
    let servicesTotal = 0;
    const parsedServices = {
      delivery: services?.delivery === 'true' || services?.delivery === true,
      deliveryPrice: parseFloat(services?.deliveryPrice) || 0,
      installation: services?.installation === 'true' || services?.installation === true,
      installationPrice: parseFloat(services?.installationPrice) || 0,
      chiefInstallation: services?.chiefInstallation === 'true' || services?.chiefInstallation === true,
      chiefInstallationPrice: parseFloat(services?.chiefInstallationPrice) || 0,
      commissioning: services?.commissioning === 'true' || services?.commissioning === true,
      commissioningPrice: parseFloat(services?.commissioningPrice) || 0,
      materials: services?.materials === 'true' || services?.materials === true,
      materialsPrice: parseFloat(services?.materialsPrice) || 0
    };

    Object.entries(parsedServices).forEach(([key, val]) => {
      if (val === true && parsedServices[key + 'Price']) {
        servicesTotal += parsedServices[key + 'Price'];
      }
    });

    // ========== РЕКОМЕНДУЕМЫЕ ОПЦИИ ==========
    const parsedOptions = [];
    if (recommendedOptions) {
      const codes = Array.isArray(recommendedOptions) ? recommendedOptions : [recommendedOptions];
      codes.forEach(code => {
        const defaultOpt = RECOMMENDED_OPTIONS[code];
        if (defaultOpt) {
          parsedOptions.push({
            code,
            name: defaultOpt.name,
            description: defaultOpt.description || '',
            price: parseInt(optionPrices[code]) || defaultOpt.price,
            image: ((req.body.optionImages || req.body.optionImage || {})[code]) || ''
          });
        }
      });
    }

    // ========== МАТЕРИАЛ ОБВЯЗКИ ==========
    // FIX: используем цену из формы (пользователь мог изменить), с fallback на дефолт
    let pipingPrice = 0;
    let pipingName = '';
    if (pipingMaterial && PIPING_MATERIALS[pipingMaterial]) {
      const rawPipingPrice = parseFloat(req.body.pipingPrice);
      pipingPrice = (!isNaN(rawPipingPrice) && rawPipingPrice >= 0)
        ? rawPipingPrice
        : PIPING_MATERIALS[pipingMaterial].basePrice;
      pipingName = PIPING_MATERIALS[pipingMaterial].name;
    }

    // ========== РАСЧЁТ СУММ ==========
    const equipmentTotal = parsedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const subtotal = equipmentTotal + servicesTotal + pipingPrice;
    const clientDiscountPercent = parseFloat(clientDiscount) || 0;
    const clientDiscountAmount = subtotal * clientDiscountPercent / 100;
    const afterClientDiscount = subtotal - clientDiscountAmount;
    const discountPercent = parseFloat(discount) || 0;
    const discountAmount = afterClientDiscount * discountPercent / 100;
    const grandTotal = afterClientDiscount - discountAmount;

    console.log('💰 Расчёт:', { equipmentTotal, servicesTotal, subtotal, grandTotal });

    // ========== СРОК ДЕЙСТВИЯ ==========
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (parseInt(validDays) || 14));

    // ========== ЧТО ВКЛЮЧЕНО ==========
    const includesList = [];
    const includesLabels = {
      delivery: 'Бесплатная доставка',
      analysis: 'Анализ воды после установки',
      consumables: 'Расходные материалы на 1 месяц',
      first_service: 'Первое ТО бесплатно',
      training: 'Обучение эксплуатации'
    };
    if (Array.isArray(includes)) {
      includes.forEach(key => {
        if (includesLabels[key]) includesList.push(includesLabels[key]);
      });
    }

    // ========== ТЕКСТЫ УСЛОВИЙ ==========
    const paymentTermsTexts = {
      '100_prepay': '100% предоплата',
      '50_50': '50% предоплата, 50% после монтажа',
      '30_70': '30% предоплата, 70% после монтажа',
      'postpay': 'Оплата по факту выполнения',
      'installment': 'Рассрочка через банк'
    };
    const deliveryTimeTexts = {
      '1-2': '1-2 рабочих дня',
      '3-5': '3-5 рабочих дней',
      '7-10': '7-10 рабочих дней'
    };
    const installationTimeTexts = {
      '1': '1 день',
      '2': '1-2 дня',
      '3': '2-3 дня'
    };

    // ========== ОБРАБОТКА ФАЙЛОВ ==========
    let finalSchemaImage = req.body.schemaImage || '';
    if (req.files && req.files['schemaImageUpload'] && req.files['schemaImageUpload'][0]) {
      const file = req.files['schemaImageUpload'][0];
      finalSchemaImage = '/uploads/schemes/' + file.filename;
    }

    let finalWorkPhotos = req.body.workPhotos || [];
    if (!Array.isArray(finalWorkPhotos)) {
      finalWorkPhotos = finalWorkPhotos ? [finalWorkPhotos] : [];
    }
    finalWorkPhotos = finalWorkPhotos.filter(p => p);
    
    if (req.files && req.files['workPhotosUpload']) {
      const uploaded = req.files['workPhotosUpload'].map(f => '/uploads/works/' + f.filename);
      finalWorkPhotos = [...finalWorkPhotos, ...uploaded].slice(0, 5);
    }

    // ========== ПРЕМИУМ ВАРИАНТ ==========
    const parsedPremiumItems = parsePremiumItems(req.body);
    const premiumEquipmentTotal = parsedPremiumItems.reduce((s, i) => s + i.quantity * i.price, 0);
    const premiumPipingMat = req.body.premiumPipingMaterial || '';
    const premiumPipingPrice = parseFloat(req.body.premiumPipingPrice) || 0;
    const premiumPipingNames = { polypropylene:'Полипропилен', metal_plastic:'Металлопластик', stainless:'Нержавейка', copper:'Медь' };
    const premiumPipingName  = premiumPipingNames[premiumPipingMat] || '';
    const premiumSvcTotal = parseFloat(req.body.premiumServicesTotal) || 0;
    const premiumTotal = premiumEquipmentTotal + premiumPipingPrice + premiumSvcTotal;

    // ========== СОЗДАНИЕ КП ==========
    const proposal = new Proposal({
      proposalType,
      clientId: client._id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      managerId: user._id,
      managerName: user.name,
      managerPhone: user.phone,
      managerEmail: user.email,

      objectAddress: objectAddress?.trim() || '',
      objectType,
      waterSource,
      residents: parseInt(residents) || 4,
      waterPoints: parseInt(waterPoints) || 8,

      waterAnalysis: analysis || {},

      schemaImage: finalSchemaImage,
      workPhotos: finalWorkPhotos,

      items: parsedItems,
      recommendedOptions: parsedOptions,

      pipingMaterial: pipingMaterial || null,
      pipingMaterialName: pipingName,
      pipingMaterialPrice: pipingPrice,

      services: parsedServices,

      equipmentTotal,
      servicesTotal,
      subtotal,
      clientDiscount: clientDiscountPercent,
      clientDiscountAmount,
      discount: discountPercent,
      discountAmount,
      totalPrice: grandTotal,

      paymentTerms,
      paymentTermsText: paymentTermsTexts[paymentTerms] || paymentTerms,
      deliveryTime,
      deliveryTimeText: deliveryTimeTexts[deliveryTime] || deliveryTime,
      installationTime,
      installationTimeText: installationTimeTexts[installationTime] || installationTime,
      validUntil,

      warrantyEquipment: parseInt(warrantyEquipment) || 24,
      warrantyInstallation: parseInt(warrantyInstallation) || 24,
      warrantyWater: parseInt(warrantyWater) || 12,

      includes: includesList,
      notes: notes?.trim() || '',
      premiumItems: parsedPremiumItems,
      premiumEquipmentTotal,
      premiumPipingMaterial: premiumPipingMat,
      premiumPipingMaterialName: premiumPipingName,
      premiumPipingPrice,
      premiumServicesTotal: premiumSvcTotal,
      premiumTotal,
      premiumNotes: req.body.premiumNotes?.trim() || '',

      company: COMPANY_INFO,
      status: 'draft'
    });

    await proposal.save();
    console.log('✅ КП создано:', proposal.proposalNumber);
    
    // Автоопределение проблем воды
    if (analysis && Object.keys(analysis).length > 0) {
      proposal.detectWaterProblems();
      proposal.calculateSavings();
      await proposal.save();
    }

    req.flash('success', `КП ${proposal.proposalNumber} успешно создано`);
    res.redirect(`/admin/proposals/${proposal._id}`);

  } catch (err) {
    console.error('❌ Ошибка создания КП:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      req.flash('error', errors.join(', '));
      return res.redirect('back');
    }
    next(err);
  }
};

// Остальные методы без изменений - просто копируем из документа
exports.show = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    
    const proposal = await Proposal.findById(id)
      .populate('clientId', 'name email phone avatar')
      .populate('managerId', 'name email phone')
      .lean();
      
    if (!proposal) {
      throw new AppError('КП не найдено', 404);
    }
    
    if (user.role === 'client' && proposal.clientId._id.toString() !== user._id) {
      throw new AppError('У вас нет доступа к этому предложению', 403);
    }
    if (user.role === 'manager' && proposal.managerId._id.toString() !== user._id) {
      throw new AppError('У вас нет доступа к этому предложению', 403);
    }
    
    if (user.role === 'client' && proposal.status === 'sent' && !proposal.viewedAt) {
      await Proposal.findByIdAndUpdate(id, {
        status: 'viewed',
        viewedAt: new Date(),
        $inc: { viewCount: 1 }
      });
      proposal.status = 'viewed';
      proposal.viewedAt = new Date();
    }
    
    res.render('pages/admin/proposals/proposal-view', {
      title: `КП ${proposal.proposalNumber}`,
      proposal,
      companyInfo: COMPANY_INFO,
      canEdit:   ['admin', 'manager'].includes(user.role) && proposal.status !== 'installed',
      canSend:   ['admin', 'manager'].includes(user.role) && !['installed','rejected'].includes(proposal.status),
      canDelete: ['admin', 'manager'].includes(user.role) && ['draft','rejected','expired'].includes(proposal.status),
      canAccept: user.role === 'client' && ['sent', 'viewed'].includes(proposal.status),
      canSetStatus: ['admin', 'manager'].includes(user.role),
      canReject: user.role === 'client' && ['sent', 'viewed'].includes(proposal.status),
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id)
      .populate('clientId', 'name email phone discount')
      .lean();
      
    if (!proposal) {
      throw new AppError('КП не найдено', 404);
    }
    
    if (proposal.status !== 'draft') {
      req.flash('error', 'Можно редактировать только черновики');
      return res.redirect(`/admin/proposals/${id}`);
    }

    const [clients, products] = await Promise.all([
      User.find({ role: 'client', isActive: true })
        .select('name email phone discount')
        .sort({ name: 1 })
        .lean(),
      Product.find({ deletedAt: null })
        .select('name price sku unit category description image images proposalCategory')
        .populate('category', 'name')
        .limit(200)
        .lean()
    ]);

    const productsWithImages = products.map(p => ({
      ...p,
      image: p.image || (p.images && p.images[0]) || null
    }));

    // Загрузка схем и фото (как в createForm)
    let schemes = [];
    const schemesDir = path.join(__dirname, '../../public/uploads/schemes');
    try {
      if (fs.existsSync(schemesDir)) {
        schemes = fs.readdirSync(schemesDir)
          .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
          .map(f => '/uploads/schemes/' + f).slice(0, 20);
      }
    } catch(e) {}

    let workPhotos = [];
    const worksDir = path.join(__dirname, '../../public/uploads/works');
    try {
      if (fs.existsSync(worksDir)) {
        workPhotos = fs.readdirSync(worksDir)
          .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
          .map(f => '/uploads/works/' + f).slice(0, 20);
      }
    } catch(e) {}

    res.render('pages/admin/proposals/proposal-edit', {
      title: `Редактировать ${proposal.proposalNumber}`,
      proposal,
      clients,
      products: productsWithImages,
      schemes,
      workPhotos,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id);
    
    if (!proposal) {
      throw new AppError('КП не найдено', 404);
    }
    
    if (proposal.status !== 'draft') {
      throw new AppError('Можно редактировать только черновики', 400);
    }
    
    const {
      proposalType,
      objectAddress,
      objectType,
      waterSource,
      residents,
      waterPoints,
      analysis,
      items,
      services,
      discount = '0',
      paymentTerms,
      deliveryTime,
      installationTime,
      validDays,
      warrantyEquipment,
      warrantyInstallation,
      warrantyWater,
      includes,
      notes,
      recommendedOptions,
      optionPrices = {},
      pipingMaterial,
      clientDiscount = '0'
    } = req.body;
    
    const parsedItems = parseItems(items, req.body);
    if (parsedItems.length === 0) {
      throw new AppError('Добавьте хотя бы одну позицию', 400);
    }
    
    let servicesTotal = 0;
    const parsedServices = {
      delivery: services?.delivery === 'true' || services?.delivery === true,
      deliveryPrice: parseFloat(services?.deliveryPrice) || 0,
      installation: services?.installation === 'true' || services?.installation === true,
      installationPrice: parseFloat(services?.installationPrice) || 0,
      chiefInstallation: services?.chiefInstallation === 'true' || services?.chiefInstallation === true,
      chiefInstallationPrice: parseFloat(services?.chiefInstallationPrice) || 0,
      commissioning: services?.commissioning === 'true' || services?.commissioning === true,
      commissioningPrice: parseFloat(services?.commissioningPrice) || 0,
      materials: services?.materials === 'true' || services?.materials === true,
      materialsPrice: parseFloat(services?.materialsPrice) || 0
    };
    
    Object.entries(parsedServices).forEach(([key, val]) => {
      if (val === true && parsedServices[key + 'Price']) {
        servicesTotal += parsedServices[key + 'Price'];
      }
    });
    
    const parsedOptions = [];
    if (recommendedOptions) {
      const codes = Array.isArray(recommendedOptions) ? recommendedOptions : [recommendedOptions];
      codes.forEach(code => {
        const defaultOpt = RECOMMENDED_OPTIONS[code];
        if (defaultOpt) {
          parsedOptions.push({
            code,
            name: defaultOpt.name,
            description: defaultOpt.description || '',
            price: parseInt(optionPrices[code]) || defaultOpt.price,
            image: ((req.body.optionImages || req.body.optionImage || {})[code]) || ''
          });
        }
      });
    }
    
    let pipingPrice = 0;
    let pipingName = '';
    if (pipingMaterial && PIPING_MATERIALS[pipingMaterial]) {
      const rawPipingPrice = parseFloat(req.body.pipingPrice);
      pipingPrice = (!isNaN(rawPipingPrice) && rawPipingPrice >= 0)
        ? rawPipingPrice
        : PIPING_MATERIALS[pipingMaterial].basePrice;
      pipingName = PIPING_MATERIALS[pipingMaterial].name;
    }
    
    const equipmentTotal = parsedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const subtotal = equipmentTotal + servicesTotal + pipingPrice;
    const clientDiscountPercent = parseFloat(clientDiscount) || 0;
    const clientDiscountAmount = subtotal * clientDiscountPercent / 100;
    const afterClientDiscount = subtotal - clientDiscountAmount;
    const discountPercent = parseFloat(discount) || 0;
    const discountAmount = afterClientDiscount * discountPercent / 100;
    const grandTotal = afterClientDiscount - discountAmount;
    
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (parseInt(validDays) || 14));
    
    const includesList = [];
    const includesLabels = {
      delivery: 'Бесплатная доставка',
      analysis: 'Анализ воды после установки',
      consumables: 'Расходные материалы на 1 месяц',
      first_service: 'Первое ТО бесплатно',
      training: 'Обучение эксплуатации'
    };
    if (Array.isArray(includes)) {
      includes.forEach(key => {
        if (includesLabels[key]) includesList.push(includesLabels[key]);
      });
    }
    
    const paymentTermsTexts = {
      '100_prepay': '100% предоплата',
      '50_50': '50% предоплата, 50% после',
      '30_70': '30% предоплата, 70% после',
      'postpay': 'Оплата по факту',
      'installment': 'Рассрочка'
    };
    const deliveryTimeTexts = {
      '1-2': '1-2 рабочих дня',
      '3-5': '3-5 рабочих дней',
      '7-10': '7-10 рабочих дней'
    };
    const installationTimeTexts = {
      '1': '1 день',
      '2': '1-2 дня',
      '3': '2-3 дня'
    };
    
    // ========== ПРЕМИУМ ВАРИАНТ (update) ==========
    const parsedPremiumItemsU = parsePremiumItems(req.body);
    const premiumEqTotalU = parsedPremiumItemsU.reduce((s, i) => s + i.quantity * i.price, 0);
    const premiumPipingMatU = req.body.premiumPipingMaterial || '';
    const premiumPipingPriceU = parseFloat(req.body.premiumPipingPrice) || 0;
    const premiumPipingNamesMap = { polypropylene:'Полипропилен', metal_plastic:'Металлопластик', stainless:'Нержавейка', copper:'Медь' };
    const premiumPipingNameU  = premiumPipingNamesMap[premiumPipingMatU] || '';
    const premiumSvcTotalU    = parseFloat(req.body.premiumServicesTotal) || 0;
    const premiumTotalU = premiumEqTotalU + premiumPipingPriceU + premiumSvcTotalU;

    Object.assign(proposal, {
      proposalType: proposalType || proposal.proposalType,
      objectAddress: objectAddress?.trim() || '',
      objectType,
      waterSource,
      residents: parseInt(residents) || 4,
      waterPoints: parseInt(waterPoints) || 8,
      waterAnalysis: analysis || {},
      items: parsedItems,
      recommendedOptions: parsedOptions,
      pipingMaterial: pipingMaterial || null,
      pipingMaterialName: pipingName,
      pipingMaterialPrice: pipingPrice,
      services: parsedServices,
      equipmentTotal,
      servicesTotal,
      subtotal,
      clientDiscount: clientDiscountPercent,
      clientDiscountAmount,
      discount: discountPercent,
      discountAmount,
      totalPrice: grandTotal,
      paymentTerms,
      paymentTermsText: paymentTermsTexts[paymentTerms] || paymentTerms,
      deliveryTime,
      deliveryTimeText: deliveryTimeTexts[deliveryTime] || deliveryTime,
      installationTime,
      installationTimeText: installationTimeTexts[installationTime] || installationTime,
      validUntil,
      warrantyEquipment: parseInt(warrantyEquipment) || 24,
      warrantyInstallation: parseInt(warrantyInstallation) || 24,
      warrantyWater: parseInt(warrantyWater) || 12,
      includes: includesList,
      notes: notes?.trim() || '',
      premiumItems:              parsedPremiumItemsU,
      premiumEquipmentTotal:     premiumEqTotalU,
      premiumPipingMaterial:     premiumPipingMatU,
      premiumPipingMaterialName: premiumPipingNameU,
      premiumPipingPrice:        premiumPipingPriceU,
      premiumServicesTotal:      premiumSvcTotalU,
      premiumTotal:              premiumTotalU,
      premiumNotes:              req.body.premiumNotes?.trim() || ''
    });
    
    await proposal.save();
    
    req.flash('success', `${proposal.proposalNumber} обновлено`);
    res.redirect(`/admin/proposals/${id}`);
  } catch (err) {
    console.error('❌ Ошибка обновления КП:', err);
    next(err);
  }
};

exports.send = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    const proposal = await Proposal.findById(id);
    
    if (!proposal) throw new AppError('КП не найдено', 404);
    if (proposal.status !== 'draft') throw new AppError('Можно отправить только черновик', 400);
    
    proposal.status = 'sent';
    proposal.sentAt = new Date();
    proposal.sentBy = user._id;
    await proposal.save();
    
    // FIX #13: реально отправляем email клиенту
    try {
      const clientUser = await User.findById(proposal.clientId).select('email name').lean();
      if (clientUser?.email) {
        const proposalUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/proposals/${proposal._id}`;
        const validDate = proposal.validUntil
          ? new Date(proposal.validUntil).toLocaleDateString('ru-RU')
          : 'не указана';
        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || 'CRM'}" <${process.env.SMTP_USER}>`,
          to: clientUser.email,
          subject: `Коммерческое предложение ${proposal.proposalNumber}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2>Здравствуйте, ${clientUser.name}!</h2>
              <p>Для вас подготовлено коммерческое предложение <b>${proposal.proposalNumber}</b>
                 на сумму <b>${(proposal.totalPrice || 0).toLocaleString('ru-RU')} ₽</b>.</p>
              <p style="margin:24px 0">
                <a href="${proposalUrl}"
                   style="background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
                  Открыть предложение
                </a>
              </p>
              <p style="color:#6b7280;font-size:14px">
                Предложение действительно до: ${validDate}.<br>
                Если у вас есть вопросы — свяжитесь с вашим менеджером.
              </p>
            </div>`
        });
      }
    } catch (emailErr) {
      // Не роняем запрос из-за ошибки почты — статус уже сохранён
      console.error('⚠️ Не удалось отправить email клиенту:', emailErr.message);
    }
    
    req.flash('success', `КП ${proposal.proposalNumber} отправлено клиенту`);
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Предложение отправлено' });
    }
    res.redirect(`/admin/proposals/${id}`);
  } catch (err) {
    next(err);
  }
};

exports.accept = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const user = req.session.user;
    const proposal = await Proposal.findById(id);
    
    if (!proposal) throw new AppError('КП не найдено', 404);
    if (proposal.clientId.toString() !== user._id) throw new AppError('Вы не можете принять это предложение', 403);
    if (!['sent', 'viewed'].includes(proposal.status)) throw new AppError('Невозможно принять это предложение', 400);
    
    proposal.status = 'accepted';
    proposal.acceptedAt = new Date();
    proposal.acceptedBy = user._id;
    proposal.clientComment = comment || '';
    await proposal.save();
    
    req.flash('success', 'Вы приняли коммерческое предложение');
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Предложение принято' });
    }
    res.redirect(`/proposals/${id}`);
  } catch (err) {
    next(err);
  }
};

exports.reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.session.user;
    
    if (!reason || !reason.trim()) throw new AppError('Укажите причину отклонения', 400);
    
    const proposal = await Proposal.findById(id);
    if (!proposal) throw new AppError('КП не найдено', 404);
    if (proposal.clientId.toString() !== user._id) throw new AppError('Вы не можете отклонить это предложение', 403);
    
    proposal.status = 'rejected';
    proposal.rejectedAt = new Date();
    proposal.rejectedBy = user._id;
    proposal.rejectReason = reason.trim();
    await proposal.save();
    
    req.flash('success', 'Вы отклонили коммерческое предложение');
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Предложение отклонено' });
    }
    res.redirect(`/proposals/${id}`);
  } catch (err) {
    next(err);
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    const original = await Proposal.findById(id).lean();
    
    if (!original) throw new AppError('КП не найдено', 404);
    
    delete original._id;
    delete original.proposalNumber;
    delete original.createdAt;
    delete original.updatedAt;
    delete original.sentAt;
    delete original.viewedAt;
    delete original.acceptedAt;
    delete original.rejectedAt;
    delete original.sentBy;
    delete original.acceptedBy;
    delete original.rejectedBy;
    delete original.__v;
    
    original.status = 'draft';
    original.managerId = user._id;
    original.managerName = user.name;
    
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 14);
    original.validUntil = validUntil;
    
    const duplicate = new Proposal(original);
    await duplicate.save();
    
    req.flash('success', `Создана копия: ${duplicate.proposalNumber}`);
    res.redirect(`/admin/proposals/${duplicate._id}`);
  } catch (err) {
    console.error('❌ Ошибка дублирования:', err);
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id);
    
    if (!proposal) throw new AppError('КП не найдено', 404);
    if (proposal.status !== 'draft') throw new AppError('Можно удалить только черновик', 400);
    
    await Proposal.deleteOne({ _id: id });
    
    req.flash('success', `КП ${proposal.proposalNumber} удалено`);
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'КП удалено' });
    }
    res.redirect('/admin/proposals');
  } catch (err) {
    console.error('❌ Ошибка удаления КП:', err);
    next(err);
  }
};

exports.generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id).lean();
    if (!proposal) throw new AppError('КП не найдено', 404);

    res.render('pages/admin/proposals/proposal-print', {
      layout: false,
      title: `КП ${proposal.proposalNumber}`,
      p: proposal,
      companyInfo: COMPANY_INFO
    });
  } catch (err) {
    next(err);
  }
};

exports.searchProducts = async (req, res, next) => {
  try {
    const { q, category, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr) || 50, 300);
    const filter = { deletedAt: null };
    
    if (q && q.length >= 1) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        { sku:  new RegExp(escapeRegex(q), 'i') }
      ];
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    const products = await Product.find(filter)
      .select('name price sku unit category description image images proposalCategory')
      .populate('category', 'name')
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    
    const productsWithImages = products.map(p => ({
      ...p,
      image: p.image || (p.images && p.images[0]) || null
    }));
    
    res.json({ success: true, products: productsWithImages });
  } catch (err) {
    next(err);
  }
};

exports.getClientData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await User.findById(id)
      .select('name email phone discount address')
      .lean();
      
    if (!client) {
      return res.status(404).json({ success: false, message: 'Клиент не найден' });
    }
    
    const lastAnalysis = await Proposal.findOne({ clientId: id })
      .select('waterAnalysis')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      client,
      lastAnalysis: lastAnalysis?.waterAnalysis || null
    });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
/**
 * POST /admin/proposals/:id/status — изменение статуса КП
 */
exports.setStatus = async (req, res, next) => {
  try {
    const user = req.session.user;
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'КП не найден' });

    const { status, variant, installNotes } = req.body;

    const allowed = ['draft','sent','viewed','accepted','accepted_premium','in_progress','installed','rejected','expired'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Неверный статус' });

    const prev = proposal.status;
    proposal.status = status;

    // При принятии — фиксируем выбранный вариант и сумму
    if (status === 'accepted') {
      proposal.acceptedVariant  = 'standard';
      proposal.acceptedAmount   = proposal.totalPrice || 0;
      proposal.acceptedAt       = new Date();
      proposal.acceptedBy       = user._id;
    }
    if (status === 'accepted_premium') {
      proposal.acceptedVariant  = 'premium';
      proposal.acceptedAmount   = proposal.premiumTotal || 0;
      proposal.acceptedAt       = new Date();
      proposal.acceptedBy       = user._id;
    }
    if (status === 'in_progress') {
      if (!proposal.acceptedAt) {
        proposal.acceptedAt    = new Date();
        proposal.acceptedBy    = user._id;
        proposal.acceptedVariant = variant === 'premium' ? 'premium' : 'standard';
        proposal.acceptedAmount  = variant === 'premium' ? (proposal.premiumTotal||0) : (proposal.totalPrice||0);
      }
    }
    if (status === 'installed') {
      proposal.installedAt   = new Date();
      proposal.installedBy   = user._id;
      proposal.installNotes  = installNotes || '';
      if (!proposal.acceptedAt) {
        proposal.acceptedAt   = new Date();
        proposal.acceptedBy   = user._id;
        proposal.acceptedVariant = variant === 'premium' ? 'premium' : 'standard';
        proposal.acceptedAmount  = variant === 'premium' ? (proposal.premiumTotal||0) : (proposal.totalPrice||0);
      }
    }
    if (status === 'rejected') {
      proposal.rejectedAt = new Date();
      proposal.rejectedBy = user._id;
      proposal.rejectReason = req.body.reason || '';
    }
    if (status === 'sent' && prev === 'draft') {
      proposal.sentAt = new Date();
      proposal.sentBy = user._id;
    }

    await proposal.save();

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({ ok: true, status: proposal.status });
    }
    req.flash('success', 'Статус обновлён');
    res.redirect(`/admin/proposals/${proposal._id}`);
  } catch (err) {
    next(err);
  }
};

