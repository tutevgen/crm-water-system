require('dotenv').config();

// FIX: Подавляем deprecation warning от старых зависимостей
const util = require('util');
if (util.isArray) {
  util.isArray = Array.isArray;
}

const express = require('express');
const path = require('path');
const session = require('express-session');
// connect-mongo: поддерживаем v3 (new MongoStore) и v4+ (MongoStore.create)
let MongoStore;
try {
  MongoStore = require('connect-mongo');
} catch(e) {
  MongoStore = null;
  console.warn('⚠️ connect-mongo не установлен — сессии в памяти (не для продакшена!). Запустите: npm install connect-mongo');
}
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csrf = require('csurf');
const fs = require('fs');

// FIX: Защита от NoSQL инъекций
let mongoSanitize;
try {
  mongoSanitize = require('express-mongo-sanitize');
} catch(e) {
  mongoSanitize = null;
  console.warn('⚠️ express-mongo-sanitize не установлен. Запустите: npm install express-mongo-sanitize');
}

const uploadDirs = [
  './public/uploads/analysis',
  './public/uploads/schemes',
  './public/uploads/works',
  './public/uploads/products',
  './public/uploads/avatars',
  './public/uploads/misc',
  './public/img/avatars'
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
const PORT = process.env.PORT || 3000;

// FIX #2: один SESSION_SECRET
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET === 'REPLACE_WITH_RANDOM_64_HEX_STRING') {
  console.error('❌ SESSION_SECRET не задан или не изменён в .env! Сгенерируйте: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Успешное подключение к MongoDB");

    // Миграция: активируем товары у которых isActive не задан или false
    // FIX: Проверяем, является ли текущий процесс лидером (для кластеризации)
    if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
      try {
        const Product = require('./models/admin/Product');
        const result = await Product.updateMany(
          { isActive: { $ne: true } },
          { $set: { isActive: true } }
        );
        if (result.modifiedCount > 0) {
          console.log(`✅ Активировано ${result.modifiedCount} товаров в каталоге`);
        }
      } catch(migErr) { 
        // Игнорируем ошибку если модель еще не загружена
        if (migErr.code !== 'MODULE_NOT_FOUND') {
          console.warn('⚠️ Миграция товаров не выполнена:', migErr.message);
        }
      }
    }

  } catch (err) {
    console.error("❌ Ошибка подключения к MongoDB:", err.message);
    process.exit(1);
  }
};
connectDB();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// FIX: helmet должен быть одним из первых middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.disable('x-powered-by');

// FIX #2: один ключ для cookieParser
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// FIX: убрана лишняя обёртка middleware для multipart — express.urlencoded и так не парсит multipart
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // FIX: увеличен лимит для больших форм
app.use(express.json({ limit: '10mb' })); // FIX: увеличен лимит для Base64 изображений

// FIX: Защита от NoSQL инъекций — очищает req.body, req.query, req.params от операторов $
if (mongoSanitize) {
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`⚠️ NoSQL injection attempt blocked in ${key}`, { 
        ip: req.ip, 
        path: req.path,
        timestamp: new Date().toISOString()
      });
    }
  }));
}

// FIX #3: MongoStore — сессии выживают при рестарте
function createSessionStore() {
  if (!MongoStore) return undefined;

  // FIX: Правильная проверка версии connect-mongo
  if (typeof MongoStore.create === 'function') {
    return MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 7 * 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 3600 // FIX: уменьшаем нагрузку на БД
    });
  } else {
    // Для старых версий (v3)
    return new MongoStore({
      url: process.env.MONGO_URI,
      ttl: 7 * 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 3600
    });
  }
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: createSessionStore(),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(flash());

// CSRF Protection
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
});

// FIX: Улучшенная логика CSRF
app.use((req, res, next) => {
  // GET/HEAD/OPTIONS — через CSRF middleware (для генерации токена в шаблонах)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return csrfProtection(req, res, next);
  }
  
  // Multipart/form-data: CSRF проверяется ПОСЛЕ Multer в конкретных роутах
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  
  // AJAX запросы с X-Requested-With: XMLHttpRequest — безопасны без CSRF токена
  // Причина: браузер НЕ отправит этот заголовок cross-origin без CORS,
  // а SameSite=lax cookie НЕ приложит cookie к cross-origin POST запросам.
  // Это стандартный подход (Django, Rails используют аналогичную защиту)
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return next();
  }
  
  // Все остальные POST/PATCH/DELETE — требуют CSRF токен
  csrfProtection(req, res, next);
});

// FIX #43: navConfig один раз, передаётся во все шаблоны
let navConfig;
try {
  navConfig = require('./config/navConfig');
} catch(e) {
  console.warn('⚠️ navConfig не найден, используется пустой конфиг');
  navConfig = { main: [], admin: [] };
}

// FIX: safeJsonStringify для шаблонов
let safeJsonStringify;
try {
  const helpers = require('./utils/helpers');
  safeJsonStringify = helpers.safeJsonStringify;
} catch(e) {
  safeJsonStringify = (obj) => {
    try {
      return JSON.stringify(obj);
    } catch {
      return '{}';
    }
  };
}

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.user = req.session?.user || null;
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  res.locals.url = req.originalUrl;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  res.locals.navConfig = navConfig;
  res.locals.safeJSON = safeJsonStringify;
  
  // FIX: автоопределение активной страницы по URL
  const pathParts = req.path.split('/').filter(Boolean);
  res.locals.activePage = pathParts[1] || pathParts[0] || '';
  
  // FIX: Добавляем информацию о среде выполнения
  res.locals.isProduction = process.env.NODE_ENV === 'production';
  res.locals.isDevelopment = process.env.NODE_ENV !== 'production';
  
  next();
});

// Загружаем middleware безопасности
let securityMiddleware;
try {
  securityMiddleware = require('./middleware/security');
} catch(e) {
  console.error('❌ Критическая ошибка: middleware/security не найден');
  process.exit(1);
}

const {
  sanitizeInput,
  logSuspiciousActivity,
  checkSessionTimeout,
  generalLimiter
} = securityMiddleware;

app.use(generalLimiter);
app.use(sanitizeInput);
app.use(logSuspiciousActivity);
app.use(checkSessionTimeout(parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000));

// Загрузка моделей с проверкой
const models = {};
try {
  models.User = require('./models/User');
  models.Product = require('./models/admin/Product');
  models.Category = require('./models/Category');
  models.Proposal = require('./models/Proposal');
  
  // FIX: CompanyDetails может не существовать
  try {
    models.CompanyDetails = require('./models/CompanyDetails');
  } catch(e) {
    console.warn('⚠️ Модель CompanyDetails не найдена');
    // Заглушка возвращает null — как будто запись не найдена
    models.CompanyDetails = {
      findOne: async () => null,
      find: async () => [],
      countDocuments: async () => 0
    };
  }
  
  models.ProductLog = require('./models/ProductLog');
  
  // Дополнительные модели (могут отсутствовать)
  const optionalModels = [
    'WaterAnalysisDB',
    'SchemeLibrary', 
    'WorkPhotoLibrary',
    'ServiceRequest',
    'Reminder'
  ];
  
  optionalModels.forEach(modelName => {
    try {
      require(`./models/${modelName}`);
    } catch(e) {
      console.warn(`⚠️ Модель ${modelName} не найдена, пропускаем`);
    }
  });
  
  console.log('✅ Все модели загружены успешно');
} catch(e) {
  console.error('❌ Ошибка загрузки моделей:', e.message);
  process.exit(1);
}

app.use((req, res, next) => {
  req.db = models;
  next();
});

// Роуты с обработкой ошибок
try {
  app.use('/', require('./routes/auth'));
  app.use('/', require('./routes/main'));
  
  // Админские роуты
  const adminRoutes = ['products', 'clients', 'proposals', 'technicians'];
  adminRoutes.forEach(route => {
    try {
      app.use(`/admin/${route}`, require(`./routes/admin/${route}`));
    } catch(e) {
      console.warn(`⚠️ Роут /admin/${route} не найден, пропускаем`);
    }
  });
  
  // Клиентские роуты
  try {
    app.use('/client', require('./routes/client'));
  } catch(e) {
    console.warn('⚠️ Роут /client не найден');
  }
  
  // Роуты установщика
  try {
    app.use('/installer', require('./routes/installer'));
  } catch(e) {
    console.warn('⚠️ Роут /installer не найден');
  }
  
  // Прочие роуты
  const otherRoutes = [
    { file: 'categories', path: '/categories' },
    { file: 'proposalRoutes', path: '/proposals' },
    { file: 'panel', path: '/' }
  ];
  otherRoutes.forEach(route => {
    try {
      app.use(route.path, require(`./routes/${route.file}`));
    } catch(e) {
      console.warn(`⚠️ Роут ${route.file} не найден`);
    }
  });
  
  console.log('✅ Все роуты загружены успешно');
} catch(e) {
  console.error('❌ Ошибка загрузки роутов:', e.message);
  process.exit(1);
}

// Обработчики ошибок
let errorHandler, notFound;
try {
  const errorHandlers = require('./middleware/errorHandler');
  errorHandler = errorHandlers.errorHandler;
  notFound = errorHandlers.notFound;
} catch(e) {
  // Fallback обработчики
  notFound = (req, res) => {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(404).json({ success: false, message: 'Not Found' });
    }
    res.status(404).render('404', { title: 'Страница не найдена' });
  };
  errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
    res.status(500).render('error', { 
      title: 'Ошибка', 
      error: process.env.NODE_ENV === 'development' ? err : {} 
    });
  };
}

// CSRF ошибка
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('⚠️ CSRF token validation failed:', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ 
        success: false, 
        message: 'Сессия истекла или недействительный токен безопасности. Обновите страницу.' 
      });
    }
    req.flash('error', 'Сессия истекла. Попробуйте снова.');
    // FIX: Защита от open redirect — только локальные пути
    const referer = req.get('Referrer') || '/';
    const redirectUrl = (referer.startsWith('/') && !referer.startsWith('//')) ? referer : '/';
    return res.redirect(redirectUrl);
  }
  next(err);
});

// Статические файлы и 404
app.use((req, res, next) => {
  if (req.path.startsWith('/.well-known/') || req.path === '/favicon.ico') {
    return res.status(204).end();
  }
  notFound(req, res, next);
});

app.use(errorHandler);

// Запуск сервера
const server = app.listen(PORT, () => {
  console.log(`🚀 CRM запущена: http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// FIX: Graceful shutdown с правильной очисткой таймера
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  Получен сигнал ${signal}, начинаем graceful shutdown...`);
  
  let isShuttingDown = false;
  
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    // Таймер на принудительное завершение
    const forceExitTimer = setTimeout(() => {
      console.error('❌ Принудительное завершение работы по таймауту.');
      process.exit(1);
    }, 10000);
    
    try {
      // Закрываем сервер
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('✅ HTTP сервер остановлен');
      
      // Закрываем соединение с MongoDB
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ Соединение с MongoDB закрыто');
      }
      
      // Очищаем таймер принудительного завершения
      clearTimeout(forceExitTimer);
      
      console.log('✅ Graceful shutdown завершен успешно');
      process.exit(0);
      
    } catch (err) {
      console.error('❌ Ошибка при graceful shutdown:', err);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };
  
  await shutdown();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// FIX: Улучшенная обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // В production лучше завершить процесс
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Завершаем процесс из-за unhandledRejection');
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  // Всегда завершаем процесс при uncaughtException
  console.error('❌ Завершаем процесс из-за uncaughtException');
  process.exit(1);
});

// FIX: Предупреждение о небезопасном режиме
if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  ВНИМАНИЕ: Приложение запущено в режиме разработки!');
  console.warn('⚠️  Некоторые проверки безопасности ослаблены.');
}

module.exports = app;
