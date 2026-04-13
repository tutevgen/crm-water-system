const rateLimit = require('express-rate-limit');

/* =====================================================
   HELPERS
===================================================== */

function isJsonRequest(req) {
  return (
    req.xhr ||
    req.headers.accept?.includes('json') ||
    req.headers['content-type']?.includes('application/json')
  );
}

/* =====================================================
   RATE LIMITERS
===================================================== */

/**
 * Общий лимитер для всех запросов
 * FIX: увеличен до 500 — 100 слишком мало для CRM (страница = 10-30 ресурсов)
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    if (isJsonRequest(req)) {
      return res.status(429).json({
        success: false,
        message: 'Слишком много запросов. Попробуйте позже.'
      });
    }
    req.flash('error', 'Слишком много запросов. Попробуйте позже.');
    res.redirect('back');
  }
});

/**
 * Лимитер для аутентификации
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    if (isJsonRequest(req)) {
      return res.status(429).json({
        success: false,
        message: 'Слишком много попыток входа. Попробуйте через 15 минут.'
      });
    }
    req.flash('error', 'Слишком много попыток входа. Попробуйте через 15 минут.');
    res.redirect('/login');
  }
});

/**
 * Лимитер для API
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Лимитер для создания сущностей
 */
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    if (isJsonRequest(req)) {
      return res.status(429).json({
        success: false,
        message: 'Слишком много операций создания. Попробуйте позже.'
      });
    }
    req.flash('error', 'Слишком много операций. Попробуйте позже.');
    res.redirect('back');
  }
});

/**
 * Лимитер для загрузки файлов
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

/* =====================================================
   SESSION TIMEOUT
===================================================== */

const checkSessionTimeout = (timeout = 30 * 60 * 1000) => {
  return (req, res, next) => {
    if (req.session?.user) {
      const now = Date.now();

      if (req.session.lastActivity && now - req.session.lastActivity > timeout) {
        req.session.destroy(() => {});
        if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with']) {
          return res.status(401).json({
            success: false,
            message: 'Сессия истекла. Войдите снова.',
            redirectTo: '/login'
          });
        }
        return res.redirect('/login');
      }

      req.session.lastActivity = now;
    }
    next();
  };
};

/* =====================================================
   INPUT SANITIZATION
===================================================== */

// FIX: Используем библиотечный подход вместо ненадёжных RegExp
// Удаляем опасные HTML-теги и атрибуты
const DANGEROUS_TAGS = /<(script|iframe|object|embed|form|meta|link|style|svg|math|base|applet)[^>]*>[\s\S]*?<\/\1>/gi;
const DANGEROUS_SELF_CLOSING = /<(script|iframe|object|embed|form|meta|link|base|applet)[^>]*\/?>/gi;
const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;
const JAVASCRIPT_PROTOCOL = /(?:href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

function sanitizeValue(val) {
  if (typeof val === 'string') {
    return val
      .replace(DANGEROUS_TAGS, '')
      .replace(DANGEROUS_SELF_CLOSING, '')
      .replace(EVENT_HANDLERS, '')
      .replace(JAVASCRIPT_PROTOCOL, '')
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') {
    const sanitized = {};
    Object.keys(val).forEach(k => { sanitized[k] = sanitizeValue(val[k]); });
    return sanitized;
  }
  return val;
}

const sanitizeInput = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') return next();
  Object.keys(req.body).forEach(key => {
    req.body[key] = sanitizeValue(req.body[key]);
  });
  next();
};

/* =====================================================
   SUSPICIOUS ACTIVITY LOGGING
===================================================== */

const logSuspiciousActivity = (req, res, next) => {
  const patterns = [
    /(\.\.[\\/]){2,}/,
    /<script|javascript:|onerror=/i,
    /union.*select|insert.*into|drop.*table/i,
    /etc\/passwd|cmd\.exe|\/bin\/sh/i
  ];

  const payload = `${req.path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;

  for (const pattern of patterns) {
    if (pattern.test(payload)) {
      console.warn('⚠️ Подозрительная активность:', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        user: req.session?.user?.email || 'guest',
        ua: req.get('user-agent'),
        time: new Date().toISOString()
      });
      break;
    }
  }

  next();
};

/* =====================================================
   FILE TYPE CHECK
===================================================== */

const checkFileType = (allowed = []) => {
  return (req, res, next) => {
    if (req.file && allowed.length && !allowed.includes(req.file.mimetype)) {
      req.flash('error', 'Недопустимый тип файла');
      return res.redirect('back');
    }
    next();
  };
};

/* =====================================================
   EXPORTS
===================================================== */

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  createLimiter,
  uploadLimiter,

  checkSessionTimeout,
  sanitizeInput,
  logSuspiciousActivity,
  checkFileType
};
