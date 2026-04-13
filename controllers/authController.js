const User = require('../models/User');
const { buildSessionUser } = require('../utils/helpers');
const nodemailer = require('nodemailer');
const { AppError } = require('../middleware/errorHandler');

// Конфигурация email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465, // true для 465, false для других портов
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Проверка конфигурации email при старте
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Ошибка конфигурации SMTP:', error);
  } else {
    console.log('✅ SMTP сервер готов к отправке писем');
  }
});

/**
 * Генерация 6-значного кода
 */
function generateCode() {
  return require('crypto').randomInt(100000, 999999).toString();
}

/**
 * Отправка email с кодом подтверждения
 */
async function sendVerificationEmail(email, code, name) {
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'CRM System'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Код подтверждения регистрации',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Здравствуйте, ${name}!</h2>
          <p style="font-size: 16px;">Ваш код подтверждения для завершения регистрации:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4CAF50; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="font-size: 14px; color: #666;">
            Код действителен в течение 15 минут.<br>
            Если вы не регистрировались на нашем сайте, проигнорируйте это письмо.
          </p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Ошибка отправки email:', error);
    return false;
  }
}

/**
 * Отправка SMS с кодом подтверждения
 */
async function sendVerificationSMS(phone, code) {
  // Здесь интеграция с SMS провайдером
  // Пример для популярных провайдеров:
  
  if (!process.env.SMS_API_KEY) {
    console.warn('⚠️ SMS_API_KEY не настроен, SMS не будет отправлена');
    return false;
  }
  
  try {
    // Пример для SMS.ru (раскомментируйте и настройте для вашего провайдера)
    /*
    const axios = require('axios');
    const response = await axios.get('https://sms.ru/sms/send', {
      params: {
        api_id: process.env.SMS_API_KEY,
        to: phone,
        msg: `Ваш код подтверждения: ${code}`,
        json: 1
      }
    });
    
    if (response.data.status === 'OK') {
      return true;
    }
    */
    
    // Для разработки - просто выводим в консоль
    if (process.env.NODE_ENV === 'development') { console.log(`📱 [DEV] SMS код отправлен на ${phone}: ${code}`); }
    return true;
    
  } catch (error) {
    console.error('Ошибка отправки SMS:', error);
    return false;
  }
}

/**
 * Валидация email
 */
function isValidEmail(email) {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Валидация телефона
 */
function isValidPhone(phone) {
  return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(phone);
}

/**
 * Отображение страницы регистрации
 */
exports.showRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Регистрация',
    csrfToken: res.locals.csrfToken,
    error: res.locals.error,
    success: res.locals.success
  });
};

/**
 * Регистрация пользователя
 */
exports.register = async (req, res, next) => {
  try {
    const { name, login, password, confirmPassword } = req.body;
    const errors = [];
    
    // Валидация
    if (!name || !name.trim()) {
      errors.push('Укажите имя');
    } else if (name.trim().length < 2) {
      errors.push('Имя должно содержать минимум 2 символа');
    }
    
    if (!login || !login.trim()) {
      errors.push('Укажите телефон или email');
    }
    
    if (!password) {
      errors.push('Введите пароль');
    } else if (password.length < 6) {
      errors.push('Пароль должен быть не короче 6 символов');
    }
    
    if (password !== confirmPassword) {
      errors.push('Пароли не совпадают');
    }
    
    // Определяем тип логина
    const isPhone = isValidPhone(login);
    const isEmail = isValidEmail(login);
    
    if (!isPhone && !isEmail) {
      errors.push('Введите корректный номер телефона или email');
    }
    
    // Если есть ошибки валидации
    if (errors.length > 0) {
      return res.render('auth/register', {
        title: 'Регистрация',
        name,
        login,
        csrfToken: res.locals.csrfToken,
        error: errors,
        success: []
      });
    }
    
    // Проверка на существующего пользователя
    const query = isEmail 
      ? { email: login.toLowerCase() }
      : { phone: login };
    
    const existing = await User.findOne(query);
    
    if (existing) {
      return res.render('auth/register', {
        title: 'Регистрация',
        name,
        login,
        csrfToken: res.locals.csrfToken,
        error: ['Пользователь с таким телефоном или email уже существует'],
        success: []
      });
    }
    
    // Генерация кода подтверждения
    const verificationCode = generateCode();
    const verificationExpires = Date.now() + 15 * 60 * 1000; // 15 минут
    
    // Создание пользователя
    const newUser = new User({
      name: name.trim(),
      email: isEmail ? login.toLowerCase() : null,
      phone: isPhone ? login : null,
      login: login.toLowerCase(),
      isPhone: isPhone,
      password: password, // Хешируется автоматически в pre-save хуке модели
      verificationCode,
      verificationExpires,
      role: 'client' // По умолчанию клиент
    });
    
    await newUser.save();
    
    // Отправка кода подтверждения
    let sendSuccess = false;
    
    if (isEmail) {
      sendSuccess = await sendVerificationEmail(login, verificationCode, name);
      if (sendSuccess) {
        req.flash('success', `Код подтверждения отправлен на ${login}`);
      } else {
        req.flash('error', 'Не удалось отправить email. Обратитесь к администратору.');
      }
    } else if (isPhone) {
      sendSuccess = await sendVerificationSMS(login, verificationCode);
      if (sendSuccess) {
        req.flash('success', `Код подтверждения отправлен на ${login}`);
      } else {
        req.flash('error', 'Не удалось отправить SMS. Обратитесь к администратору.');
      }
    }
    
    // Сохраняем ID пользователя в сессии для верификации
    req.session.verifyUserId = newUser._id.toString();
    req.session.verifyLogin = login;
    
    res.redirect('/verify');
    
  } catch (err) {
    console.error('Ошибка при регистрации:', err);
    
    // Обработка ошибки дубликата (на случай race condition)
    if (err.code === 11000) {
      return res.render('auth/register', {
        title: 'Регистрация',
        name: req.body.name,
        login: req.body.login,
        csrfToken: res.locals.csrfToken,
        error: ['Пользователь с таким логином уже зарегистрирован'],
        success: []
      });
    }
    
    next(err);
  }
};

/**
 * Отображение страницы верификации
 */
exports.showVerify = (req, res) => {
  if (!req.session.verifyUserId) {
    req.flash('error', 'Сначала необходимо зарегистрироваться');
    return res.redirect('/register');
  }
  
  res.render('auth/verify', {
    title: 'Подтверждение',
    login: req.session.verifyLogin,
    csrfToken: res.locals.csrfToken
  });
};

/**
 * Верификация кода
 */
exports.verify = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!req.session.verifyUserId) {
      req.flash('error', 'Сессия истекла. Пожалуйста, зарегистрируйтесь снова');
      return res.redirect('/register');
    }
    
    if (!code || code.length !== 6) {
      req.flash('error', 'Введите 6-значный код');
      return res.redirect('/verify');
    }
    
    const user = await User.findById(req.session.verifyUserId)
      .select('+verificationCode +verificationExpires');
    
    if (!user) {
      req.flash('error', 'Пользователь не найден');
      return res.redirect('/register');
    }
    
    // Проверка срока действия кода
    if (user.verificationExpires < Date.now()) {
      req.flash('error', 'Срок действия кода истек. Запросите новый код');
      return res.redirect('/verify');
    }
    
    // Проверка кода
    if (user.verificationCode !== code) {
      req.flash('error', 'Неверный код подтверждения');
      return res.redirect('/verify');
    }
    
    // Подтверждаем пользователя
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();
    
    // Автоматический вход после верификации
    req.session.user = buildSessionUser(user);
    req.session.user.isVerified = true;
    
    // Очищаем временные данные
    delete req.session.verifyUserId;
    delete req.session.verifyLogin;
    
    req.flash('success', 'Регистрация успешно завершена!');
    res.redirect('/client/dashboard');
    
  } catch (err) {
    console.error('Ошибка при верификации:', err);
    next(err);
  }
};

/**
 * Повторная отправка кода
 */
exports.resendCode = async (req, res, next) => {
  try {
    if (!req.session.verifyUserId) {
      return res.status(400).json({
        success: false,
        message: 'Сессия истекла'
      });
    }
    
    const user = await User.findById(req.session.verifyUserId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь уже подтвержден'
      });
    }
    
    // Генерируем новый код
    const newCode = user.generateVerificationCode();
    await user.save();
    
    // Отправляем код
    let sendSuccess = false;
    
    if (user.email) {
      sendSuccess = await sendVerificationEmail(user.email, newCode, user.name);
    } else if (user.phone) {
      sendSuccess = await sendVerificationSMS(user.phone, newCode);
    }
    
    if (sendSuccess) {
      res.json({
        success: true,
        message: 'Код подтверждения отправлен повторно'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Не удалось отправить код. Попробуйте позже'
      });
    }
    
  } catch (err) {
    console.error('Ошибка при повторной отправке кода:', err);
    next(err);
  }
};

/**
 * Отображение страницы входа
 */
exports.showLogin = (req, res) => {
  // Проверяем query параметры для показа сообщений
  let success = res.locals.success || [];
  let error = res.locals.error || [];
  
  if (req.query.logout === 'success') {
    success = ['Вы успешно вышли из системы'];
  }
  if (req.query.reset === 'success') {
    success = ['Пароль успешно изменён. Войдите с новым паролем'];
  }
  if (req.query.error === 'logout_failed') {
    error = ['Ошибка при выходе из системы'];
  }
  
  res.render('auth/login', {
    title: 'Вход',
    csrfToken: res.locals.csrfToken,
    error,
    success
  });
};

/**
 * Вход в систему
 */
exports.login = async (req, res, next) => {
  try {
    const { login, password } = req.body;
    
    // Валидация
    if (!login || !password) {
      return res.render('auth/login', {
        title: 'Вход',
        login,
        csrfToken: res.locals.csrfToken,
        error: ['Введите логин и пароль'],
        success: []
      });
    }
    
    // Поиск пользователя
    const user = await User.findByLogin(login);
    
    if (!user) {
      console.log(`⚠️ Попытка входа с несуществующим логином: ${login}`);
      return res.render('auth/login', {
        title: 'Вход',
        login,
        csrfToken: res.locals.csrfToken,
        error: ['Неверный логин или пароль'],
        success: []
      });
    }
    
    // Проверка активности
    if (user.isActive === false) {
      return res.render('auth/login', {
        title: 'Вход',
        login,
        csrfToken: res.locals.csrfToken,
        error: ['Ваш аккаунт деактивирован. Обратитесь к администратору'],
        success: []
      });
    }
    
    // Проверка пароля
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Вход',
        login,
        csrfToken: res.locals.csrfToken,
        error: ['Неверный логин или пароль'],
        success: []
      });
    }
    
    // Обновляем время последнего входа (без валидации всех полей)
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: Date.now() } }
    );
    
    // Создаем сессию
    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      isVerified: user.isVerified,
      discount: user.discount
    };
    
    req.session.lastActivity = Date.now();
    
    // Редирект на сохраненную страницу или на дашборд
    const rawReturnTo = req.session.returnTo;
    delete req.session.returnTo;
    // FIX #21: только внутренние пути — защита от open redirect
    const safeReturnTo = (rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//'))
      ? rawReturnTo
      : `/${user.role}/dashboard`;
    res.redirect(safeReturnTo);
    
  } catch (err) {
    console.error('Ошибка при входе:', err);
    next(err);
  }
};

/**
 * Выход из системы
 */
exports.logout = (req, res) => {
  const userName = req.session?.user?.name;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Ошибка при выходе:', err);
      // Не используем flash после destroy - просто редиректим
      return res.redirect('/login?error=logout_failed');
    }
    
    res.clearCookie('connect.sid');
    res.clearCookie('_csrf'); // Очищаем CSRF cookie тоже
    
    // Редиректим с параметром успеха (flash недоступен после destroy)
    res.redirect('/login?logout=success');
  });
};

// ============================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================

/**
 * Отображение страницы запроса восстановления пароля
 */
exports.showForgotPassword = (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Восстановление пароля',
    csrfToken: res.locals.csrfToken,
    error: res.locals.error || [],
    success: res.locals.success || []
  });
};

/**
 * Обработка запроса на восстановление пароля
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { login } = req.body;
    
    if (!login || !login.trim()) {
      return res.render('auth/forgot-password', {
        title: 'Восстановление пароля',
        csrfToken: res.locals.csrfToken,
        error: ['Введите email или телефон'],
        success: []
      });
    }
    
    // Поиск пользователя
    const user = await User.findByLogin(login.trim());
    
    if (!user) {
      // FIX: Не раскрываем, существует ли пользователь — одинаковый ответ
      req.flash('success', 'Если аккаунт с таким контактом существует, код восстановления отправлен');
      return res.redirect('/login');
    }
    
    // Генерируем код сброса
    const resetCode = require('crypto').randomInt(100000, 999999).toString();
    const resetExpires = Date.now() + 15 * 60 * 1000; // 15 минут
    
    // Сохраняем код в базу (используем updateOne чтобы избежать валидации всех полей)
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          resetPasswordCode: resetCode, 
          resetPasswordExpires: resetExpires 
        } 
      }
    );
    
    // Отправляем код
    let sendSuccess = false;
    
    if (user.email) {
      sendSuccess = await sendPasswordResetEmail(user.email, resetCode, user.name);
    } else if (user.phone) {
      sendSuccess = await sendPasswordResetSMS(user.phone, resetCode);
    }
    
    if (!sendSuccess) {
      return res.render('auth/forgot-password', {
        title: 'Восстановление пароля',
        login,
        csrfToken: res.locals.csrfToken,
        error: ['Не удалось отправить код. Попробуйте позже'],
        success: []
      });
    }
    
    // Сохраняем в сессию для следующего шага
    req.session.resetUserId = user._id.toString();
    req.session.resetLogin = login;
    
    res.redirect('/reset-password-code');
    
  } catch (err) {
    console.error('Ошибка при запросе восстановления пароля:', err);
    next(err);
  }
};

/**
 * Отображение страницы ввода кода сброса
 */
exports.showResetPasswordCode = (req, res) => {
  if (!req.session.resetUserId) {
    return res.redirect('/forgot-password');
  }
  
  res.render('auth/reset-password-code', {
    title: 'Подтверждение кода',
    login: req.session.resetLogin,
    csrfToken: res.locals.csrfToken,
    error: res.locals.error || [],
    success: res.locals.success || []
  });
};

/**
 * Проверка кода сброса пароля
 */
exports.verifyResetCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!req.session.resetUserId) {
      return res.redirect('/forgot-password');
    }
    
    if (!code || code.length !== 6) {
      return res.render('auth/reset-password-code', {
        title: 'Подтверждение кода',
        login: req.session.resetLogin,
        csrfToken: res.locals.csrfToken,
        error: ['Введите 6-значный код'],
        success: []
      });
    }
    
    const user = await User.findById(req.session.resetUserId)
      .select('+resetPasswordCode +resetPasswordExpires');
    
    if (!user) {
      return res.redirect('/forgot-password');
    }
    
    // Проверка срока действия
    if (!user.resetPasswordExpires || user.resetPasswordExpires < Date.now()) {
      return res.render('auth/reset-password-code', {
        title: 'Подтверждение кода',
        login: req.session.resetLogin,
        csrfToken: res.locals.csrfToken,
        error: ['Срок действия кода истёк. Запросите новый'],
        success: []
      });
    }
    
    // Проверка кода
    if (user.resetPasswordCode !== code) {
      return res.render('auth/reset-password-code', {
        title: 'Подтверждение кода',
        login: req.session.resetLogin,
        csrfToken: res.locals.csrfToken,
        error: ['Неверный код'],
        success: []
      });
    }
    
    // Код верный - разрешаем сброс пароля
    req.session.resetCodeVerified = true;
    
    res.redirect('/reset-password');
    
  } catch (err) {
    console.error('Ошибка при проверке кода сброса:', err);
    next(err);
  }
};

/**
 * Отображение страницы установки нового пароля
 */
exports.showResetPassword = (req, res) => {
  if (!req.session.resetUserId || !req.session.resetCodeVerified) {
    return res.redirect('/forgot-password');
  }
  
  res.render('auth/reset-password', {
    title: 'Новый пароль',
    csrfToken: res.locals.csrfToken,
    error: res.locals.error || [],
    success: res.locals.success || []
  });
};

/**
 * Сохранение нового пароля
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { password, confirmPassword } = req.body;
    
    if (!req.session.resetUserId || !req.session.resetCodeVerified) {
      return res.redirect('/forgot-password');
    }
    
    // Валидация
    const errors = [];
    
    if (!password) {
      errors.push('Введите новый пароль');
    } else if (password.length < 6) {
      errors.push('Пароль должен быть не короче 6 символов');
    }
    
    if (password !== confirmPassword) {
      errors.push('Пароли не совпадают');
    }
    
    if (errors.length > 0) {
      return res.render('auth/reset-password', {
        title: 'Новый пароль',
        csrfToken: res.locals.csrfToken,
        error: errors,
        success: []
      });
    }
    
    const user = await User.findById(req.session.resetUserId);
    
    if (!user) {
      return res.redirect('/forgot-password');
    }
    
    // Хешируем пароль вручную (т.к. updateOne не запускает pre-save хуки)
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Обновляем пароль через updateOne (без валидации всех полей)
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { password: hashedPassword },
        $unset: { resetPasswordCode: '', resetPasswordExpires: '' }
      }
    );
    
    // Очищаем сессию
    delete req.session.resetUserId;
    delete req.session.resetLogin;
    delete req.session.resetCodeVerified;
    
    // Редирект на логин с сообщением
    res.redirect('/login?reset=success');
    
  } catch (err) {
    console.error('Ошибка при сбросе пароля:', err);
    next(err);
  }
};

/**
 * Повторная отправка кода сброса пароля
 */
exports.resendResetCode = async (req, res, next) => {
  try {
    if (!req.session.resetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Сессия истекла'
      });
    }
    
    const user = await User.findById(req.session.resetUserId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Генерируем новый код
    const resetCode = require('crypto').randomInt(100000, 999999).toString();
    
    // Используем updateOne чтобы избежать валидации всех полей
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          resetPasswordCode: resetCode, 
          resetPasswordExpires: Date.now() + 15 * 60 * 1000 
        } 
      }
    );
    
    // Отправляем
    let sendSuccess = false;
    
    if (user.email) {
      sendSuccess = await sendPasswordResetEmail(user.email, resetCode, user.name);
    } else if (user.phone) {
      sendSuccess = await sendPasswordResetSMS(user.phone, resetCode);
    }
    
    if (sendSuccess) {
      res.json({ success: true, message: 'Код отправлен повторно' });
    } else {
      res.status(500).json({ success: false, message: 'Не удалось отправить код' });
    }
    
  } catch (err) {
    console.error('Ошибка при повторной отправке кода сброса:', err);
    next(err);
  }
};

/**
 * Отправка email для сброса пароля
 */
async function sendPasswordResetEmail(email, code, name) {
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'CRM System'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Восстановление пароля',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Здравствуйте, ${name}!</h2>
          <p style="font-size: 16px;">Вы запросили восстановление пароля. Ваш код подтверждения:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #333; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="font-size: 14px; color: #666;">
            Код действителен в течение 15 минут.<br>
            Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.
          </p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Ошибка отправки email для сброса пароля:', error);
    return false;
  }
}

/**
 * Отправка SMS для сброса пароля
 */
async function sendPasswordResetSMS(phone, code) {
  if (!process.env.SMS_API_KEY) {
    if (process.env.NODE_ENV === 'development') { console.log(`📱 [DEV] SMS код сброса отправлен на ${phone}: ${code}`); }
    return true;
  }
  
  try {
    // Интеграция с SMS провайдером
    if (process.env.NODE_ENV === 'development') { console.log(`📱 [DEV] SMS код сброса отправлен на ${phone}: ${code}`); }
    return true;
  } catch (error) {
    console.error('Ошибка отправки SMS для сброса пароля:', error);
    return false;
  }
}