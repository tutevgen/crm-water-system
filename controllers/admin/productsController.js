const { escapeRegex } = require("../../utils/helpers");
const Product = require('../../models/admin/Product');
const Category = require('../../models/Category');
const ProductLog = require('../../models/ProductLog');
const path = require('path');
const fs = require('fs');

/**
 * Список товаров
 */
exports.index = async (req, res, next) => {
  try {
    const { search, category, isVisible, sort, page = 1, limit = 20 } = req.query;
    
    const filter = { deletedAt: null };
    
    // Поиск по нескольким полям
    if (search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { sku: new RegExp(escapeRegex(search), 'i') },
        { description: new RegExp(escapeRegex(search), 'i') },
        { brand: new RegExp(escapeRegex(search), 'i') }
      ];
    }
    
    // Фильтр по категории
    if (category) filter.category = category;
    
    // Фильтр по видимости
    if (isVisible === 'true') filter.isVisible = true;
    else if (isVisible === 'false') filter.isVisible = false;
    
    // Фильтры по характеристикам
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('char_') && req.query[key]) {
        const charName = decodeURIComponent(key.replace('char_', ''));
        filter['characteristics.' + charName] = req.query[key];
      }
    });
    
    // Сортировка
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'name_asc': sortOption = { name: 1 }; break;
      case 'name_desc': sortOption = { name: -1 }; break;
      case 'price_asc': sortOption = { price: 1 }; break;
      case 'price_desc': sortOption = { price: -1 }; break;
      case 'oldest': sortOption = { createdAt: 1 }; break;
      case 'category': sortOption = { category: 1, name: 1 }; break;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Загружаем данные параллельно
    let products = [];
    let totalProducts = 0;
    let categoriesRaw = [];
    let logs = [];
    let charValues = {};
    
    try {
      [products, totalProducts, categoriesRaw, logs] = await Promise.all([
        Product.find(filter).populate('category', 'name slug').sort(sortOption).skip(skip).limit(parseInt(limit)).lean(),
        Product.countDocuments(filter),
        Category.find().sort({ name: 1 }).lean(),
        ProductLog.find().populate('user', 'name').populate('product', 'name').sort({ timestamp: -1 }).limit(10).lean()
      ]);
    } catch (err) {
      console.error('Ошибка загрузки основных данных:', err);
    }
    
    // Загружаем характеристики отдельно (может не быть метода)
    try {
      if (typeof Product.getCharacteristicsValues === 'function') {
        charValues = await Product.getCharacteristicsValues();
      } else {
        // Fallback - собираем характеристики вручную
        const allProducts = await Product.find({ deletedAt: null }).select('characteristics').lean();
        charValues = {};
        allProducts.forEach(p => {
          if (p.characteristics) {
            const chars = p.characteristics instanceof Map ? Object.fromEntries(p.characteristics) : p.characteristics;
            Object.keys(chars).forEach(key => {
              if (!charValues[key]) charValues[key] = new Set();
              if (chars[key]) charValues[key].add(chars[key]);
            });
          }
        });
        // Конвертируем Set в массивы
        Object.keys(charValues).forEach(key => {
          charValues[key] = Array.from(charValues[key]).sort();
        });
      }
    } catch (err) {
      console.error('Ошибка загрузки характеристик:', err);
      charValues = {};
    }

    // FIX #27: один агрегатный запрос вместо N countDocuments
    let categories = [];
    try {
      const counts = await Product.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
      const countMap = {};
      counts.forEach(c => { countMap[c._id ? c._id.toString() : '__null'] = c.count; });
      categories = categoriesRaw.map(cat => ({
        ...cat,
        productCount: countMap[cat._id.toString()] || 0
      }));
    } catch (err) {
      console.error('Ошибка подсчёта товаров в категориях:', err);
      categories = categoriesRaw;
    }

    res.render('pages/admin/products', {
      title: 'Товары',
      products,
      categories,
      logs,
      charValues,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limit),
      page: parseInt(page),
      search: search || '',
      category: category || '',
      isVisible: isVisible || '',
      sort: sort || '',
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    console.error('❌ Ошибка в index:', err);
    next(err);
  }
};

exports.listProducts = exports.index;

/**
 * Форма создания
 */
exports.createForm = async (req, res, next) => {
  try {
    const [categories, brands] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Product.getBrands()
    ]);
    
    res.render('pages/admin/product-form', {
      title: 'Новый товар',
      isEdit: false,
      product: {},
      categories,
      brands,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Форма редактирования
 */
exports.editForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [product, categories, brands] = await Promise.all([
      Product.findById(id).populate('category', 'name').lean(),
      Category.find().sort({ name: 1 }).lean(),
      Product.getBrands()
    ]);
    
    if (!product) {
      req.flash('error', 'Товар не найден');
      return res.redirect('/admin/products');
    }
    
    res.render('pages/admin/product-form', {
      title: 'Редактирование: ' + product.name,
      isEdit: true,
      product,
      categories,
      brands,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Создание товара
 */
exports.create = async (req, res, next) => {
  try {
    const user = req.session.user;
    const data = parseProductData(req.body);
    
    if (!data.name) return res.status(400).json({ success: false, message: 'Название обязательно' });
    if (!data.category) return res.status(400).json({ success: false, message: 'Выберите категорию' });
    if (!data.price && data.price !== 0) return res.status(400).json({ success: false, message: 'Укажите цену' });
    
    // Главное фото
    if (req.files && req.files.photo && req.files.photo[0]) {
      data.photo = '/uploads/products/' + req.files.photo[0].filename;
    } else if (req.file) {
      data.photo = '/uploads/products/' + req.file.filename;
    }
    
    // Галерея
    if (req.files && req.files.galleryFiles) {
      data.gallery = req.files.galleryFiles.map((f, i) => ({
        url: '/uploads/products/' + f.filename,
        isMain: i === 0 && !data.photo,
        order: i
      }));
    }
    
    // Документы
    if (req.files && req.files.documentFiles) {
      const docType = req.body.documentType || 'other';
      data.documents = req.files.documentFiles.map(f => ({
        name: f.originalname,
        type: docType,
        file: '/uploads/products/' + f.filename,
        size: f.size
      }));
    }
    
    data.createdBy = user._id;
    
    const product = new Product(data);
    await product.save();
    
    await ProductLog.create({ product: product._id, user: user._id, action: 'create' });
    
    res.json({ success: true, product, message: 'Товар создан' });
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Товар с таким артикулом уже существует' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProduct = exports.create;

/**
 * Обновление товара
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    const data = parseProductData(req.body);
    
    // Обновляем поля
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) product[key] = data[key];
    });
    
    // Главное фото
    if (req.files && req.files.photo && req.files.photo[0]) {
      if (product.photo) deleteFile(product.photo);
      product.photo = '/uploads/products/' + req.files.photo[0].filename;
    } else if (req.file) {
      if (product.photo) deleteFile(product.photo);
      product.photo = '/uploads/products/' + req.file.filename;
    }
    
    // Добавляем новые фото в галерею
    if (req.files && req.files.galleryFiles) {
      const newImages = req.files.galleryFiles.map((f, i) => ({
        url: '/uploads/products/' + f.filename,
        isMain: false,
        order: (product.gallery ? product.gallery.length : 0) + i
      }));
      product.gallery = product.gallery ? product.gallery.concat(newImages) : newImages;
    }
    
    // Добавляем новые документы
    if (req.files && req.files.documentFiles) {
      const docType = req.body.documentType || 'other';
      const newDocs = req.files.documentFiles.map(f => ({
        name: f.originalname,
        type: docType,
        file: '/uploads/products/' + f.filename,
        size: f.size
      }));
      product.documents = product.documents ? product.documents.concat(newDocs) : newDocs;
    }
    
    product.updatedBy = user._id;
    await product.save();
    
    await ProductLog.create({ product: product._id, user: user._id, action: 'update' });
    
    res.json({ success: true, product, message: 'Товар обновлен' });
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProduct = exports.update;

/**
 * Удаление товара
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    await product.softDelete(user._id);
    await ProductLog.create({ product: product._id, user: user._id, action: 'delete' });
    
    res.json({ success: true, message: 'Товар удален' });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = exports.delete;

/**
 * Восстановление
 */
exports.restoreProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    await product.restore();
    await ProductLog.create({ product: product._id, user: user._id, action: 'restore' });
    
    res.json({ success: true, message: 'Товар восстановлен' });
  } catch (err) {
    next(err);
  }
};

/**
 * Видимость
 */
exports.toggleVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;
    const user = req.session.user;
    
    const result = await Product.updateOne({ _id: id }, { $set: { isVisible: isVisible === true || isVisible === 'true', updatedBy: user._id } });
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    await ProductLog.create({ product: id, user: user._id, action: 'visibility' });
    res.json({ success: true, message: 'Видимость изменена' });
  } catch (err) {
    next(err);
  }
};

/**
 * Дублирование
 */
exports.duplicate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.session.user;
    
    const original = await Product.findById(id).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    delete original._id;
    delete original.slug;
    delete original.sku;
    delete original.createdAt;
    delete original.updatedAt;
    original.name = original.name + ' (копия)';
    original.isVisible = false;
    original.createdBy = user._id;
    original.metadata = { views: 0, sales: 0, rating: 0, reviewsCount: 0 };
    
    const newProduct = new Product(original);
    await newProduct.save();
    
    await ProductLog.create({ product: newProduct._id, user: user._id, action: 'create' });
    
    res.json({ success: true, productId: newProduct._id, message: 'Копия создана' });
  } catch (err) {
    next(err);
  }
};

/**
 * Получить товар по ID
 */
exports.getById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

/**
 * Удалить изображение из галереи
 */
exports.deleteGalleryImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    const image = product.gallery.id(imageId);
    if (image) {
      deleteFile(image.url);
      product.gallery.pull(imageId);
      await product.save();
    }
    
    res.json({ success: true, message: 'Изображение удалено' });
  } catch (err) {
    next(err);
  }
};

/**
 * Установить главное изображение
 */
exports.setMainImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    product.gallery.forEach(img => { img.isMain = img._id.toString() === imageId; });
    const mainImg = product.gallery.find(img => img.isMain);
    if (mainImg) product.photo = mainImg.url;
    
    await product.save();
    res.json({ success: true, message: 'Главное изображение установлено' });
  } catch (err) {
    next(err);
  }
};

/**
 * Удалить документ
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id, docId } = req.params;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    
    const doc = product.documents.id(docId);
    if (doc) {
      deleteFile(doc.file);
      product.documents.pull(docId);
      await product.save();
    }
    
    res.json({ success: true, message: 'Документ удален' });
  } catch (err) {
    next(err);
  }
};

/**
 * Характеристики
 */
exports.getCharValues = async (req, res, next) => {
  try {
    const charValues = await Product.getCharacteristicsValues();
    res.json({ success: true, charValues });
  } catch (err) {
    next(err);
  }
};

/**
 * Экспорт CSV
 */
exports.exportCSV = async (req, res, next) => {
  try {
    const products = await Product.find({ deletedAt: null }).populate('category', 'name').sort({ name: 1 }).lean();
    
    let csv = 'Название;Артикул;Категория;Цена;Оптовая;Кол-во;Склад;Видим\n';
    products.forEach(p => {
      csv += `"${p.name || ''}";"${p.sku || ''}";"${p.category ? p.category.name : ''}";${p.price || 0};${p.wholesalePrice || ''};${p.quantity || 0};"${p.warehouse || ''}";${p.isVisible ? 'Да' : 'Нет'}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
};

/**
 * === КАТЕГОРИИ ===
 */
exports.getCategories = async (req, res, next) => {
  try {
    // FIX #27: один агрегат вместо N запросов
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Product.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);
    const countMap = {};
    counts.forEach(c => { if (c._id) countMap[c._id.toString()] = c.count; });
    const result = categories.map(cat => ({
      ...cat,
      productCount: countMap[cat._id.toString()] || 0
    }));
    res.json({ success: true, categories: result });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, parent } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Название обязательно' });
    
    const existing = await Category.findOne({ name: new RegExp('^' + escapeRegex(name.trim()) + '$', 'i') });
    if (existing) return res.status(400).json({ success: false, message: 'Категория уже существует' });
    
    const category = new Category({ name: name.trim(), parent: parent || null });
    await category.save();
    
    res.json({ success: true, category, message: 'Категория создана' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Категория уже существует' });
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, parent } = req.body;
    
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: 'Категория не найдена' });
    
    if (parent === id) return res.status(400).json({ success: false, message: 'Категория не может быть родителем себя' });
    
    category.name = name.trim();
    category.parent = parent || null;
    await category.save();
    
    res.json({ success: true, category, message: 'Категория обновлена' });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const children = await Category.countDocuments({ parent: id });
    if (children > 0) return res.status(400).json({ success: false, message: 'Сначала удалите дочерние категории' });
    
    await Product.updateMany({ category: id }, { $unset: { category: '' } });
    await Category.deleteOne({ _id: id });
    
    res.json({ success: true, message: 'Категория удалена' });
  } catch (err) {
    next(err);
  }
};

// ===== Вспомогательные функции =====

function parseProductData(body) {
  const data = {
    name: body.name ? body.name.trim() : undefined,
    category: body.category || undefined,
    brand: body.brand || undefined,
    price: body.price ? parseFloat(body.price) : undefined,
    wholesalePrice: body.wholesalePrice ? parseFloat(body.wholesalePrice) : undefined,
    oldPrice: body.oldPrice ? parseFloat(body.oldPrice) : undefined,
    sku: body.sku || undefined,
    quantity: body.quantity !== undefined ? parseInt(body.quantity) : undefined,
    unit: body.unit || undefined,
    warehouse: body.warehouse || undefined,
    warranty: body.warranty ? parseInt(body.warranty) : undefined,
    countryOfOrigin: body.countryOfOrigin || undefined,
    weight: body.weight ? parseFloat(body.weight) : undefined,
    videoUrl: body.videoUrl || undefined,
    shortDescription: body.shortDescription || undefined,
    description: body.description || undefined,
    isActive: true, // всегда активен при создании/обновлении
    proposalCategory: body.proposalCategory || '',
    isVisible: body.isVisible === 'true' || body.isVisible === true,
    isFeatured: body.isFeatured === 'true' || body.isFeatured === true,
    isNewProduct: body.isNewProduct === 'true' || body.isNewProduct === true
  };
  
  // Характеристики
  if (body.characteristics) {
    try {
      data.characteristics = typeof body.characteristics === 'string' ? JSON.parse(body.characteristics) : body.characteristics;
    } catch (e) {}
  }
  
  // Габариты
  if (body.dimensions) {
    data.dimensions = {
      length: body.dimensions.length ? parseFloat(body.dimensions.length) : undefined,
      width: body.dimensions.width ? parseFloat(body.dimensions.width) : undefined,
      height: body.dimensions.height ? parseFloat(body.dimensions.height) : undefined
    };
  }
  
  // SEO
  if (body.seo) {
    data.seo = {
      title: body.seo.title || undefined,
      description: body.seo.description || undefined,
      keywords: body.seo.keywords || undefined
    };
  }
  
  return data;
}

function deleteFile(filePath) {
  if (!filePath) return;
  const fullPath = path.join(__dirname, '../../public', filePath);
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath); } catch (e) { console.warn('Не удалось удалить файл:', e); }
  }
}

/**
 * POST /admin/products/activate-all — активировать все товары (для отладки)
 */
exports.activateAll = async (req, res, next) => {
  try {
    const result = await Product.updateMany(
      {},
      { $set: { isActive: true, isVisible: true } }
    );
    res.json({ success: true, updated: result.modifiedCount, message: `Активировано ${result.modifiedCount} товаров` });
  } catch (err) {
    next(err);
  }
};


/**
 * POST /admin/products/:id/proposal-category — быстрое назначение категории КП
 */
exports.setProposalCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { proposalCategory } = req.body;
    const allowed = ['', 'Аэрация', 'Обезжелезивание', 'Умягчение',
                     'Механическая очистка', 'Обратный осмос', 'УФ-обеззараживание', 'Дополнительное оборудование'];
    if (!allowed.includes(proposalCategory)) {
      return res.status(400).json({ success: false, message: 'Недопустимая категория' });
    }
    await Product.findByIdAndUpdate(id, { proposalCategory });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

