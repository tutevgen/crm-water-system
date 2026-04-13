/**
 * Centralized Error Handler Middleware
 * Обрабатывает все ошибки приложения
 */

/**
 * Класс для пользовательских ошибок приложения
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Обработчик ошибок Mongoose
 */
const handleMongooseError = (err) => {
  // Ошибка валидации
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return new AppError(`Ошибка валидации: ${errors.join(', ')}`, 400);
  }
  
  // Дубликат уникального поля
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return new AppError(`${field} уже используется. Пожалуйста, используйте другое значение.`, 400);
  }
  
  // Ошибка приведения типа
  if (err.name === 'CastError') {
    return new AppError(`Некорректное значение для поля ${err.path}`, 400);
  }
  
  return err;
};

/**
 * Обработчик ошибок JWT
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Недействительный токен. Пожалуйста, войдите снова.', 401);
  }
  
  if (err.name === 'TokenExpiredError') {
    return new AppError('Срок действия токена истек. Пожалуйста, войдите снова.', 401);
  }
  
  return err;
};

/**
 * Обработчик ошибок Multer (загрузка файлов)
 */
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('Файл слишком большой. Максимальный размер: 10MB', 400);
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Слишком много файлов', 400);
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Неожиданное поле файла', 400);
  }
  
  return err;
};

/**
 * FIX: Фильтрация чувствительных данных из логов
 */
const SENSITIVE_FIELDS = ['password', 'confirmPassword', 'currentPassword', 'newPassword', 'token', 'secret', 'creditCard', 'passportSeries', 'passportNumber'];

function filterSensitiveData(body) {
  if (!body || typeof body !== 'object') return body;
  const filtered = { ...body };
  SENSITIVE_FIELDS.forEach(field => {
    if (filtered[field]) filtered[field] = '[FILTERED]';
  });
  return filtered;
}

/**
 * Логирование ошибки
 */
const logError = (err, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: err.message,
    statusCode: err.statusCode || 500,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    user: req.session?.user?.email || 'Неавторизован',
    body: filterSensitiveData(req.body),
    query: req.query,
    params: req.params
  };
  
  // В production можно отправлять в систему мониторинга (Sentry, LogRocket и т.д.)
  if (err.statusCode >= 500) {
    console.error('💥 Критическая ошибка:', errorLog);
  } else {
    console.warn('⚠️ Ошибка клиента:', errorLog);
  }
};

/**
 * Отправка ответа об ошибке в режиме разработки
 */
const sendErrorDev = (err, req, res) => {
  // API запрос
  if (req.originalUrl.startsWith('/api') || req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(err.statusCode || 500).json({
      success: false,
      status: err.statusCode || 500,
      message: err.message,
      stack: err.stack,
      error: err
    });
  }
  
  // Веб-страница
  res.status(err.statusCode || 500).render('error/500', {
    title: 'Ошибка сервера',
    message: err.message,
    error: err,
    stack: err.stack,
    statusCode: err.statusCode || 500
  });
};

/**
 * Отправка ответа об ошибке в production
 */
const sendErrorProd = (err, req, res) => {
  // Операционная ошибка (доверенная) - показываем детали
  if (err.isOperational) {
    // API запрос
    if (req.originalUrl.startsWith('/api') || req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(err.statusCode).json({
        success: false,
        status: err.statusCode,
        message: err.message
      });
    }
    
    // Веб-страница
    req.flash('error', err.message);
    
    if (err.statusCode === 404) {
      return res.status(404).render('error/404', {
        title: 'Страница не найдена',
        message: err.message || 'Запрашиваемая страница не найдена'
      });
    }
    
    return res.status(err.statusCode).render('error/500', {
      title: 'Ошибка',
      message: err.message,
      statusCode: err.statusCode
    });
  }
  
  // Программная или неизвестная ошибка - скрываем детали
  console.error('💥 НЕИЗВЕСТНАЯ ОШИБКА:', err);
  
  // API запрос
  if (req.originalUrl.startsWith('/api') || req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: 'Произошла ошибка на сервере'
    });
  }
  
  // Веб-страница
  req.flash('error', 'Произошла ошибка на сервере. Мы работаем над её устранением.');
  res.status(500).render('error/500', {
    title: 'Ошибка сервера',
    message: 'Произошла непредвиденная ошибка',
    statusCode: 500
  });
};

/**
 * Главный обработчик ошибок
 */
const errorHandler = (err, req, res, next) => {
  // Устанавливаем статус код по умолчанию
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // Логируем ошибку
  logError(err, req);
  
  // Обрабатываем различные типы ошибок
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;
  
  // Mongoose ошибки
  if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
    error = handleMongooseError(err);
  }
  
  // JWT ошибки
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  }
  
  // Multer ошибки
  if (err.name === 'MulterError') {
    error = handleMulterError(err);
  }
  
  // CSRF ошибки
  if (err.code === 'EBADCSRFTOKEN') {
    error = new AppError('Недействительный CSRF токен. Пожалуйста, обновите страницу и попробуйте снова.', 403);
  }
  
  // Отправляем ответ в зависимости от окружения
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

/**
 * Обработчик для async функций
 * Оборачивает async функции и передает ошибки в next()
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Обработчик для несуществующих маршрутов (404)
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Страница ${req.originalUrl} не найдена на сервере`,
    404
  );
  next(error);
};

/**
 * Обработчик необработанных Promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Необработанное отклонение промиса:', reason);
  // В production здесь можно отправить уведомление или gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    // Логируем в систему мониторинга
    // sentry.captureException(reason);
  }
});

/**
 * Обработчик необработанных исключений
 */
process.on('uncaughtException', (error) => {
  console.error('💥 Необработанное исключение:', error);
  
  if (process.env.NODE_ENV === 'production') {
    // Логируем в систему мониторинга
    // sentry.captureException(error);
    
    // Graceful shutdown
    console.log('🛑 Завершение работы...');
    process.exit(1);
  }
});

module.exports = {
  errorHandler,
  catchAsync,
  notFound,
  AppError
};