const { escapeRegex } = require("../utils/helpers");
const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * Список монтажников
 */
exports.index = async (req, res, next) => {
  try {
    const { search, status, page = 1, success: successQuery, error: errorQuery } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Фильтр - только монтажники
    const filter = { role: 'installer' };
    
    // Поиск по имени, email или телефону
    if (search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { email: new RegExp(escapeRegex(search), 'i') },
        { phone: new RegExp(escapeRegex(search), 'i') }
      ];
    }
    
    // Фильтр по статусу
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }
    
    const [installers, total] = await Promise.all([
      User.find(filter)
        .select('name email phone avatar isVerified isActive lastLogin createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    // Формируем сообщения из query параметров
    const successMessages = [];
    const errorMessages = [];
    
    if (successQuery === 'created') successMessages.push('Монтажник успешно создан');
    if (successQuery === 'updated') successMessages.push('Монтажник успешно обновлён');
    if (successQuery === 'deleted') successMessages.push('Монтажник удалён');
    if (errorQuery === 'not_found') errorMessages.push('Монтажник не найден');
    
    res.render('pages/admin/technicians', {
      title: 'Монтажники',
      installers,
      pagination: {
        page: parseInt(page),
        totalPages,
        total
      },
      filters: { search, status },
      error: errorMessages,
      success: successMessages
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Форма создания монтажника
 */
exports.showCreate = (req, res) => {
  res.render('pages/admin/technician-form', {
    title: 'Добавить монтажника',
    installer: null,
    isEdit: false,
    csrfToken: res.locals.csrfToken,
    error: [],
    success: []
  });
};

/**
 * Создание монтажника
 */
exports.create = async (req, res, next) => {
  try {
    const { name, email, phone, password, address } = req.body;
    const errors = [];
    
    // Валидация
    if (!name || !name.trim()) {
      errors.push('Укажите имя');
    }
    
    if (!email && !phone) {
      errors.push('Укажите email или телефон');
    }
    
    if (!password || password.length < 6) {
      errors.push('Пароль должен быть не короче 6 символов');
    }
    
    // Проверка на существующего пользователя
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        errors.push('Пользователь с таким email уже существует');
      }
    }
    
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        errors.push('Пользователь с таким телефоном уже существует');
      }
    }
    
    if (errors.length > 0) {
      return res.render('pages/admin/technician-form', {
        title: 'Добавить монтажника',
        installer: { name, email, phone, address },
        isEdit: false,
        csrfToken: res.locals.csrfToken,
        error: errors,
        success: []
      });
    }
    
    // Создаём монтажника
    const installer = new User({
      name: name.trim(),
      email: email ? email.toLowerCase() : null,
      phone: phone || null,
      login: email ? email.toLowerCase() : phone,
      password,
      address: address?.trim() || null,
      role: 'installer',
      isVerified: true,
      isActive: true
    });
    
    await installer.save();
    
    res.redirect('/admin/technicians?success=created');
    
  } catch (err) {
    if (err.code === 11000) {
      return res.render('pages/admin/technician-form', {
        title: 'Добавить монтажника',
        installer: req.body,
        isEdit: false,
        csrfToken: res.locals.csrfToken,
        error: ['Пользователь с такими данными уже существует'],
        success: []
      });
    }
    next(err);
  }
};

/**
 * Форма редактирования монтажника
 */
exports.showEdit = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const installer = await User.findOne({ _id: id, role: 'installer' }).lean();
    
    if (!installer) {
      return res.redirect('/admin/technicians?error=not_found');
    }
    
    res.render('pages/admin/technician-form', {
      title: 'Редактировать монтажника',
      installer,
      isEdit: true,
      csrfToken: res.locals.csrfToken,
      error: [],
      success: []
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Обновление монтажника
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, address, isActive } = req.body;
    const errors = [];
    
    const installer = await User.findOne({ _id: id, role: 'installer' });
    
    if (!installer) {
      return res.redirect('/admin/technicians?error=not_found');
    }
    
    // Валидация
    if (!name || !name.trim()) {
      errors.push('Укажите имя');
    }
    
    if (!email && !phone) {
      errors.push('Укажите email или телефон');
    }
    
    // Проверка уникальности email
    if (email && email.toLowerCase() !== installer.email) {
      const existingEmail = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingEmail) {
        errors.push('Пользователь с таким email уже существует');
      }
    }
    
    // Проверка уникальности телефона
    if (phone && phone !== installer.phone) {
      const existingPhone = await User.findOne({ 
        phone,
        _id: { $ne: id }
      });
      if (existingPhone) {
        errors.push('Пользователь с таким телефоном уже существует');
      }
    }
    
    if (errors.length > 0) {
      return res.render('pages/admin/technician-form', { // FIX #38: было 'admin/technician-form'
        title: 'Редактировать монтажника',
        installer: { _id: id, name, email, phone, address, isActive },
        isEdit: true,
        csrfToken: res.locals.csrfToken,
        error: errors,
        success: []
      });
    }
    
    // Подготавливаем данные для обновления
    const updateData = {
      name: name.trim(),
      email: email ? email.toLowerCase() : null,
      phone: phone || null,
      login: email ? email.toLowerCase() : phone,
      address: address?.trim() || null,
      isActive: isActive === 'on' || isActive === 'true' || isActive === true
    };
    
    // Если указан новый пароль, хешируем его
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    await User.updateOne({ _id: id }, { $set: updateData });
    
    res.redirect('/admin/technicians?success=updated');
    
  } catch (err) {
    next(err);
  }
};

/**
 * Переключение статуса активности
 */
exports.toggleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const installer = await User.findOne({ _id: id, role: 'installer' });
    
    if (!installer) {
      return res.status(404).json({ success: false, message: 'Монтажник не найден' });
    }
    
    await User.updateOne(
      { _id: id },
      { $set: { isActive: !installer.isActive } }
    );
    
    res.json({ 
      success: true, 
      isActive: !installer.isActive,
      message: !installer.isActive ? 'Монтажник активирован' : 'Монтажник деактивирован'
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Удаление монтажника
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const installer = await User.findOne({ _id: id, role: 'installer' });
    
    if (!installer) {
      if (req.xhr) {
        return res.status(404).json({ success: false, message: 'Монтажник не найден' });
      }
      return res.redirect('/admin/technicians?error=not_found');
    }
    
    // TODO: Проверить, есть ли у монтажника активные задачи
    // const tasksCount = await Task.countDocuments({ installerId: id, status: { $ne: 'completed' } });
    // if (tasksCount > 0) {
    //   return res.status(400).json({ success: false, message: 'У монтажника есть активные задачи' });
    // }
    
    await User.deleteOne({ _id: id });
    
    if (req.xhr) {
      return res.json({ success: true, message: 'Монтажник удалён' });
    }
    
    res.redirect('/admin/technicians?success=deleted');
    
  } catch (err) {
    next(err);
  }
};

/**
 * Получить монтажника по ID (API)
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const installer = await User.findOne({ _id: id, role: 'installer' })
      .select('name email phone address isActive isVerified createdAt lastLogin')
      .lean();
    
    if (!installer) {
      return res.status(404).json({ success: false, message: 'Монтажник не найден' });
    }
    
    res.json({ success: true, installer });
    
  } catch (err) {
    next(err);
  }
};