const express = require('express');
const router = express.Router();
const checkRole = require('../../middleware/checkRole');
const User = require('../../models/User');
const CompanyDetails = require('../../models/CompanyDetails');
const { AppError } = require('../../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Создаем директорию для аватаров если не существует
const uploadDir = path.join(process.cwd(), 'public/img/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка загрузки аватаров
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Только изображения (jpeg, jpg, png, gif, webp)'));
  }
});

/**
 * Страница настроек клиента
 * GET /client/settings
 */
router.get('/',
  checkRole('client'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.session.user._id).lean();
      
      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }
      
      const companyDetails = await CompanyDetails.findOne({ userId: user._id }).lean();
      
      res.render('client/settings', {
        title: 'Настройки',
        activePage: 'settings',
        user,
        companyDetails,
        csrfToken: res.locals.csrfToken
      });
      
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
      next(err);
    }
  }
);

/**
 * Обновление профиля
 * POST /client/settings/profile
 */
router.post('/profile',
  checkRole('client'),
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      const { name, email, phone, address } = req.body;
      const userId = req.session.user._id;
      
      console.log('🔍 Обновление профиля. req.file:', req.file);
      
      // Валидация
      if (!name || !name.trim()) {
        throw new AppError('ФИО обязательно', 400);
      }
      
      if (email && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        throw new AppError('Некорректный email', 400);
      }
      
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }
      
      // Проверка уникальности email
      if (email && email.toLowerCase() !== user.email) {
        const existingEmail = await User.findOne({ 
          email: email.toLowerCase(),
          _id: { $ne: userId }
        });
        
        if (existingEmail) {
          throw new AppError('Email уже используется', 400);
        }
        user.email = email.toLowerCase();
      }
      
      // Проверка уникальности телефона
      if (phone && phone !== user.phone) {
        const existingPhone = await User.findOne({
          phone,
          _id: { $ne: userId }
        });
        
        if (existingPhone) {
          throw new AppError('Телефон уже используется', 400);
        }
        user.phone = phone;
      }
      
      // Обновляем основные данные
      user.name = name.trim();
      user.address = address?.trim() || user.address;
      
      // Обработка аватара
      if (req.file) {
        // Удаляем старый аватар если есть
        if (user.avatar) {
          const oldAvatarPath = path.join(uploadDir, path.basename(user.avatar));
          if (fs.existsSync(oldAvatarPath)) {
            try {
              fs.unlinkSync(oldAvatarPath);
            } catch (err) {
              console.warn('Не удалось удалить старый аватар:', err);
            }
          }
        }
        user.avatar = `/img/avatars/${req.file.filename}`;
      }
      
      await user.save();
      
      // Обновляем сессию
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
      
      req.flash('success', 'Профиль успешно обновлён');
      res.redirect('/client/settings');
      
    } catch (err) {
      console.error('Ошибка обновления профиля:', err);
      
      // Удаляем загруженный файл если произошла ошибка
      if (req.file) {
        const filePath = path.join(uploadDir, req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      next(err);
    }
  }
);

/**
 * Обновление организационных данных
 * POST /client/settings/organization
 */
router.post('/organization',
  checkRole('client'),
  async (req, res, next) => {
    try {
      const userId = req.session.user._id;
      const {
        clientType,
        // Для физлиц
        lastName,
        firstName,
        middleName,
        passportSeries,
        passportNumber,
        passportIssuedBy,
        passportIssuedDate,
        passportCode,
        birthDate,
        registrationAddress,
        // Для юрлиц и ИП
        companyName,
        shortName,
        inn,
        kpp,
        ogrn,
        legalAddress,
        postalAddress,
        bankName,
        bik,
        rs,
        ks,
        phone,
        email,
        directorName,
        directorPosition
      } = req.body;
      
      // Находим или создаем CompanyDetails
      let companyDetails = await CompanyDetails.findOne({ userId });
      
      if (!companyDetails) {
        companyDetails = new CompanyDetails({ 
          userId,
          clientType: clientType || 'individual'
        });
      }
      
      companyDetails.clientType = clientType || 'individual';
      
      // Заполняем данные в зависимости от типа
      if (clientType === 'individual') {
        companyDetails.individual = {
          lastName: lastName?.trim(),
          firstName: firstName?.trim(),
          middleName: middleName?.trim(),
          passportSeries: passportSeries?.trim(),
          passportNumber: passportNumber?.trim(),
          passportIssuedBy: passportIssuedBy?.trim(),
          passportIssuedDate: passportIssuedDate ? new Date(passportIssuedDate) : null,
          passportCode: passportCode?.trim(),
          birthDate: birthDate ? new Date(birthDate) : null,
          registrationAddress: registrationAddress?.trim()
        };
        
        if (inn) companyDetails.inn = inn.trim();
      } else {
        // Для ИП и юрлиц
        companyDetails.fullName = companyName?.trim();
        companyDetails.shortName = shortName?.trim();
        companyDetails.inn = inn?.trim();
        companyDetails.kpp = kpp?.trim();
        companyDetails.ogrn = ogrn?.trim();
        companyDetails.legalAddress = legalAddress?.trim();
        companyDetails.postalAddress = postalAddress?.trim();
        companyDetails.bank = bankName?.trim();
        companyDetails.bik = bik?.trim();
        companyDetails.rs = rs?.trim();
        companyDetails.ks = ks?.trim();
        
        if (directorName) {
          companyDetails.director = {
            fullName: directorName.trim(),
            position: directorPosition?.trim() || 'Генеральный директор',
            basedOn: 'Устава'
          };
        }
      }
      
      // Общие поля
      if (phone) companyDetails.phone = phone.trim();
      if (email) companyDetails.email = email.trim();
      
      await companyDetails.save();
      
      req.flash('success', 'Реквизиты организации обновлены');
      res.redirect('/client/settings');
      
    } catch (err) {
      console.error('Ошибка обновления реквизитов:', err);
      next(err);
    }
  }
);

/**
 * Обновление пароля
 * POST /client/settings/password
 */
router.post('/password',
  checkRole('client'),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.session.user._id;
      
      // Валидация
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new AppError('Заполните все поля', 400);
      }
      
      if (newPassword !== confirmPassword) {
        throw new AppError('Новые пароли не совпадают', 400);
      }
      
      if (newPassword.length < 6) {
        throw new AppError('Пароль должен быть не короче 6 символов', 400);
      }
      
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }
      
      // Проверка текущего пароля
      const isMatch = await user.comparePassword(currentPassword);
      
      if (!isMatch) {
        throw new AppError('Неверный текущий пароль', 400);
      }
      
      // Устанавливаем новый пароль (хешируется автоматически)
      user.password = newPassword;
      await user.save();
      
      req.flash('success', 'Пароль успешно изменён');
      res.redirect('/client/settings');
      
    } catch (err) {
      console.error('Ошибка смены пароля:', err);
      next(err);
    }
  }
);

/**
 * Удаление аккаунта (деактивация)
 * POST /client/settings/delete-account
 */
router.post('/delete-account',
  checkRole('client'),
  async (req, res, next) => {
    try {
      const { password, confirmation } = req.body;
      const userId = req.session.user._id;
      
      if (confirmation !== 'УДАЛИТЬ') {
        throw new AppError('Неверное подтверждение. Введите "УДАЛИТЬ"', 400);
      }
      
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }
      
      // Проверка пароля
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        throw new AppError('Неверный пароль', 400);
      }
      
      // Деактивируем вместо удаления
      user.isActive = false;
      await user.save();
      
      // Уничтожаем сессию
      req.session.destroy((err) => {
        if (err) {
          console.error('Ошибка при удалении сессии:', err);
        }
        res.clearCookie('connect.sid');
        req.flash('success', 'Ваш аккаунт деактивирован');
        res.redirect('/login');
      });
      
    } catch (err) {
      console.error('Ошибка удаления аккаунта:', err);
      next(err);
    }
  }
);

module.exports = router;