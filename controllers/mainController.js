const { escapeRegex } = require("../utils/helpers");
const Product = require('../models/admin/Product');
const Category = require('../models/Category');
const { AppError } = require('../middleware/errorHandler');
const nodemailer = require('nodemailer');

// FIX #39: транспорт для контактной формы
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

/**
 * Главная страница (лендинг для неавторизованных)
 */
exports.index = async (req, res, next) => {
  try {
    // Если пользователь авторизован, редиректим на его панель
    if (req.session?.user) {
      const roleRedirects = {
        admin: '/admin/dashboard',
        manager: '/manager/dashboard',
        client: '/client/dashboard',
        installer: '/installer/dashboard'
      };
      return res.redirect(roleRedirects[req.session.user.role] || '/login');
    }
    
    // Получаем популярные товары для витрины
    const featuredProducts = await Product.find({
      isVisible: true,
      isActive: true,
      isFeatured: true,
      deletedAt: null
    })
    .populate('category', 'name slug')
    .limit(6)
    .lean();
    
    res.render('index', { 
      title: 'CRM по водоочистке',
      featuredProducts
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Страница "О компании"
 */
exports.about = (req, res) => {
  res.render('pages/about', {
    title: 'О компании'
  });
};

/**
 * Страница контактов
 */
exports.contacts = (req, res) => {
  res.render('pages/contacts', {
    title: 'Контакты'
  });
};

/**
 * Страница услуг
 */
exports.services = (req, res) => {
  res.render('pages/services', {
    title: 'Наши услуги'
  });
};

/**
 * Каталог товаров (публичный)
 */
exports.catalog = async (req, res, next) => {
  try {
    const { 
      category, 
      search, 
      minPrice, 
      maxPrice,
      sort,
      page = 1,
      limit = 12 
    } = req.query;
    
    const filter = {
      isVisible: true,
      isActive: true,
      deletedAt: null
    };
    
    // Фильтр по категории
    if (category) {
      filter.category = category;
    }
    
    // Поиск
    if (search) {
      filter.$text = { $search: search };
    }
    
    // Фильтр по цене
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Сортировка
    let sortOptions = { createdAt: -1 };
    if (sort === 'price_asc') sortOptions = { price: 1 };
    if (sort === 'price_desc') sortOptions = { price: -1 };
    if (sort === 'popular') sortOptions = { 'metadata.sales': -1 };
    
    const [products, total, categories] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
      Category.getRootCategories()
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.render('pages/catalog', {
      title: 'Каталог товаров',
      products,
      categories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      },
      filters: {
        category,
        search,
        minPrice,
        maxPrice,
        sort
      }
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Детальная страница товара (публичная)
 */
exports.productDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const product = await Product.findOne({
      slug,
      isVisible: true,
      isActive: true,
      deletedAt: null
    })
    .populate('category', 'name slug')
    .lean();
    
    if (!product) {
      throw new AppError('Товар не найден', 404);
    }
    
    // Увеличиваем счетчик просмотров (не ждем результата)
    Product.findByIdAndUpdate(product._id, {
      $inc: { 'metadata.views': 1 }
    }).exec();
    
    // Получаем похожие товары
    const similarProducts = await Product.getSimilar(product._id, 4);
    
    res.render('pages/product-detail', {
      title: product.name,
      product,
      similarProducts
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Страница "Запрещено" (403)
 */
exports.forbidden = (req, res) => {
  res.status(403).render('pages/forbidden', {
    title: 'Доступ запрещен'
  });
};

/**
 * Страница "Не найдено" (404)
 */
exports.notFound = (req, res) => {
  res.status(404).render('error/404', {
    title: 'Страница не найдена'
  });
};

/**
 * Обработка контактной формы — FIX #39: реально шлём email
 */
exports.submitContactForm = async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      throw new AppError('Заполните все обязательные поля', 400);
    }

    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Сайт'}" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        replyTo: email,
        subject: `Заявка с сайта от ${name}`,
        html: `
          <h2>Новая заявка с сайта</h2>
          <table style="border-collapse:collapse">
            <tr><td style="padding:6px 12px;border:1px solid #e5e7eb"><b>Имя</b></td>
                <td style="padding:6px 12px;border:1px solid #e5e7eb">${name}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #e5e7eb"><b>Email</b></td>
                <td style="padding:6px 12px;border:1px solid #e5e7eb">${email}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #e5e7eb"><b>Телефон</b></td>
                <td style="padding:6px 12px;border:1px solid #e5e7eb">${phone || '—'}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #e5e7eb"><b>Сообщение</b></td>
                <td style="padding:6px 12px;border:1px solid #e5e7eb">${message.replace(/\n/g, '<br>')}</td></tr>
          </table>`
      });
    } catch (mailErr) {
      console.error('⚠️ Контактная форма — ошибка отправки:', mailErr.message);
    }

    req.flash('success', 'Ваше сообщение отправлено! Мы свяжемся с вами в ближайшее время.');

    if (req.xhr) {
      return res.json({ success: true, message: 'Сообщение отправлено' });
    }
    res.redirect('/contacts');
  } catch (err) {
    next(err);
  }
};

/**
 * API: Поиск товаров (для автозаполнения)
 */
exports.searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, products: [] });
    }
    
    const products = await Product.find({
      $or: [
        { name: { $regex: escapeRegex(q), $options: 'i' } },
        { sku: { $regex: escapeRegex(q), $options: 'i' } }
      ],
      isVisible: true,
      isActive: true,
      deletedAt: null
    })
    .select('name sku price photo slug')
    .limit(10)
    .lean();
    
    res.json({ success: true, products });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Переключение темы (светлая/темная)
 */
exports.toggleTheme = (req, res) => {
  const currentTheme = req.session.theme || 'light';
  req.session.theme = currentTheme === 'light' ? 'dark' : 'light';
  
  res.json({ 
    success: true, 
    theme: req.session.theme 
  });
};

/**
 * Проверка здоровья системы (healthcheck)
 */
// FIX #23: только для admin, не раскрываем данные анонимам
exports.healthCheck = (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.status(404).end();
  }
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()) + 's',
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB'
    }
  });
};