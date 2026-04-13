/**
 * Middleware для проверки роли пользователя
 * @param {...string} allowedRoles - Разрешенные роли
 * @returns {Function} Express middleware
 */
module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.session?.user;
    
    // Проверка авторизации
    if (!user) {
      req.flash('error', 'Необходима авторизация для доступа к этой странице');
      
      // Сохраняем URL для редиректа после входа
      req.session.returnTo = req.originalUrl;
      
      // Если это AJAX запрос
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({ 
          success: false, 
          message: 'Необходима авторизация',
          redirectTo: '/login'
        });
      }
      
      return res.redirect('/login');
    }
    
    // Проверка активности пользователя
    if (user.isActive === false) {
      req.flash('error', 'Ваш аккаунт деактивирован. Обратитесь к администратору.');
      req.session.destroy();
      
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ 
          success: false, 
          message: 'Аккаунт деактивирован',
          redirectTo: '/login'
        });
      }
      
      return res.redirect('/login');
    }
    
    // Проверка роли
    if (!allowedRoles.includes(user.role)) {
      req.flash('error', 'У вас нет прав доступа к этой странице');
      
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ 
          success: false, 
          message: 'Доступ запрещен'
        });
      }
      
      return res.redirect('/forbidden');
    }
    
    // Обновляем время последнего действия
    req.session.lastActivity = Date.now();
    
    next();
  };
};

/**
 * Middleware для проверки авторизации (без проверки роли)
 */
module.exports.isAuthenticated = (req, res, next) => {
  const user = req.session?.user;
  
  if (!user) {
    req.flash('error', 'Необходима авторизация для доступа к этой странице');
    req.session.returnTo = req.originalUrl;
    
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ 
        success: false, 
        message: 'Необходима авторизация',
        redirectTo: '/login'
      });
    }
    
    return res.redirect('/login');
  }
  
  // Проверка активности
  if (user.isActive === false) {
    req.flash('error', 'Ваш аккаунт деактивирован');
    req.session.destroy();
    return res.redirect('/login');
  }
  
  req.session.lastActivity = Date.now();
  next();
};

/**
 * Middleware для проверки владельца ресурса
 * Проверяет, что пользователь имеет доступ к своим данным
 */
module.exports.isOwner = (paramName = 'id') => {
  return (req, res, next) => {
    const user = req.session?.user;
    const resourceUserId = req.params[paramName];
    
    if (!user) {
      req.flash('error', 'Необходима авторизация');
      return res.redirect('/login');
    }
    
    // Админ имеет доступ ко всем ресурсам
    if (user.role === 'admin') {
      return next();
    }
    
    // Проверяем, что пользователь имеет доступ к своим данным
    if (user._id.toString() !== resourceUserId) {
      req.flash('error', 'У вас нет доступа к этому ресурсу');
      
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ 
          success: false, 
          message: 'Доступ запрещен'
        });
      }
      
      return res.redirect('/forbidden');
    }
    
    next();
  };
};

/**
 * Middleware для проверки верификации email/phone
 */
module.exports.isVerified = (req, res, next) => {
  const user = req.session?.user;
  
  if (!user) {
    req.flash('error', 'Необходима авторизация');
    return res.redirect('/login');
  }
  
  if (!user.isVerified) {
    req.flash('error', 'Необходимо подтвердить email или телефон для доступа к этой функции');
    return res.redirect('/verify');
  }
  
  next();
};

/**
 * Middleware для проверки, что пользователь НЕ авторизован
 * Используется для страниц login/register
 */
module.exports.isGuest = (req, res, next) => {
  const user = req.session?.user;
  
  if (user) {
    // Редиректим на соответствующую панель
    const roleRedirects = {
      admin: '/admin/dashboard',
      manager: '/manager/dashboard',
      client: '/client/dashboard',
      installer: '/installer/dashboard'
    };
    
    return res.redirect(roleRedirects[user.role] || '/');
  }
  
  next();
};

/**
 * Middleware для проверки multiple ролей с логикой OR
 * Хотя бы одна роль должна совпадать
 */
module.exports.hasAnyRole = (...allowedRoles) => {
  return module.exports(...allowedRoles);
};

/**
 * Middleware для проверки multiple ролей с логикой AND
 * Все указанные роли должны совпадать (для будущего расширения с multiple roles)
 */
module.exports.hasAllRoles = (...requiredRoles) => {
  return (req, res, next) => {
    const user = req.session?.user;
    
    if (!user) {
      req.flash('error', 'Необходима авторизация');
      return res.redirect('/login');
    }
    
    // Пока у нас одна роль на пользователя
    // В будущем можно расширить для массива ролей
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
    
    const hasAllRequired = requiredRoles.every(role => userRoles.includes(role));
    
    if (!hasAllRequired) {
      req.flash('error', 'У вас нет необходимых прав доступа');
      return res.redirect('/forbidden');
    }
    
    next();
  };
};

/**
 * Проверка доступа к определенным действиям
 * Для более гранулярного контроля доступа
 */
module.exports.can = (action, resource) => {
  return (req, res, next) => {
    const user = req.session?.user;
    
    if (!user) {
      req.flash('error', 'Необходима авторизация');
      return res.redirect('/login');
    }
    
    // Определяем права доступа по ролям
    const permissions = {
      admin: ['*'], // Полный доступ
      manager: ['read:all', 'create:proposal', 'update:proposal', 'read:client', 'update:client', 'create:order'],
      installer: ['read:own', 'update:own', 'read:task', 'update:task'],
      client: ['read:own', 'update:own', 'create:order', 'read:proposal']
    };
    
    const userPermissions = permissions[user.role] || [];
    
    // Админ имеет полный доступ
    if (userPermissions.includes('*')) {
      return next();
    }
    
    // Проверяем конкретное разрешение
    const permission = `${action}:${resource}`;
    
    if (userPermissions.includes(permission)) {
      return next();
    }
    
    req.flash('error', 'У вас нет прав для выполнения этого действия');
    
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ 
        success: false, 
        message: 'Доступ запрещен'
      });
    }
    
    return res.redirect('/forbidden');
  };
};