const { escapeRegex } = require("../utils/helpers");
const User = require('../models/User');
const CompanyDetails = require('../models/CompanyDetails');
const { AppError } = require('../middleware/errorHandler');

/**
 * Показать список клиентов (для админа/менеджера)
 */
exports.index = async (req, res, next) => {
  try {
    const { search, status, clientType, page = 1, limit = 20 } = req.query;
    
    // Базовый фильтр - только клиенты
    const filter = { role: 'client' };
    
    // Поиск по имени, email или телефону
    if (search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { email: new RegExp(escapeRegex(search), 'i') },
        { phone: new RegExp(escapeRegex(search), 'i') }
      ];
    }
    
    // Фильтр по статусу активности
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }
    
    // Фильтр по верификации
    if (status === 'verified') {
      filter.isVerified = true;
    } else if (status === 'unverified') {
      filter.isVerified = false;
    }
    
    const skip = (page - 1) * limit;
    
    // Получаем клиентов с пагинацией
    const [clients, total] = await Promise.all([
      User.find(filter)
        .select('name email phone avatar discount isVerified isActive createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      User.countDocuments(filter)
    ]);
    
    // Получаем детали компаний для клиентов (если есть)
    const clientIds = clients.map(c => c._id);
    const companyDetails = await CompanyDetails.find({ 
      userId: { $in: clientIds } 
    }).lean();
    
    // Добавляем детали к клиентам
    const clientsWithDetails = clients.map(client => {
      const details = companyDetails.find(d => d.userId.toString() === client._id.toString());
      return {
        ...client,
        companyDetails: details
      };
    });
    
    const totalPages = Math.ceil(total / limit);
    
    res.render('admin/clients', { 
      title: 'Клиенты',
      clients: clientsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      },
      filters: {
        search,
        status,
        clientType
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Показать форму создания клиента
 */
exports.showCreate = (req, res) => {
  res.render('admin/client-create', {
    title: 'Создать клиента',
    csrfToken: res.locals.csrfToken
  });
};

/**
 * Создать нового клиента
 */
exports.create = async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      password, 
      discount,
      clientType,
      // Для физлиц
      firstName,
      lastName,
      middleName,
      // Для юрлиц
      companyName,
      inn,
      kpp
    } = req.body;
    
    // Валидация
    if (!name || !name.trim()) {
      throw new AppError('Имя обязательно', 400);
    }
    
    if (!email && !phone) {
      throw new AppError('Укажите email или телефон', 400);
    }
    
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        throw new AppError('Email уже используется', 400);
      }
    }
    
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        throw new AppError('Телефон уже используется', 400);
      }
    }
    
    // Создаем пользователя
    const client = new User({
      name: name.trim(),
      email: email ? email.toLowerCase() : null,
      phone: phone || null,
      login: email || phone,
      isPhone: !!phone,
      password: password || Math.random().toString(36).slice(-8), // Генерируем случайный пароль если не указан
      role: 'client',
      discount: discount || 0,
      isVerified: true, // Админ создает верифицированного клиента
      isActive: true
    });
    
    await client.save();
    
    // Если указаны данные компании, создаем CompanyDetails
    if (clientType && (companyName || inn || firstName)) {
      const details = new CompanyDetails({
        userId: client._id,
        clientType: clientType || 'individual'
      });
      
      if (clientType === 'individual') {
        details.individual = {
          lastName,
          firstName,
          middleName
        };
      } else {
        details.fullName = companyName;
        details.inn = inn;
        details.kpp = kpp;
      }
      
      if (email) details.email = email;
      if (phone) details.phone = phone;
      
      await details.save();
    }
    
    req.flash('success', `Клиент ${name} успешно создан`);
    res.redirect('/admin/clients');
    
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', 'Клиент с такими данными уже существует');
      return res.redirect('/admin/clients/create');
    }
    next(err);
  }
};

/**
 * Показать детали клиента
 */
exports.show = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    
    if (!client) {
      throw new AppError('Клиент не найден', 404);
    }
    
    // Получаем детали компании
    const companyDetails = await CompanyDetails.findOne({ userId: id });
    
    // Получаем статистику клиента
    const Order = require('../models/Order'); // если есть модель Order
    const Proposal = require('../models/Proposal');
    
    const [ordersCount, proposalsCount, totalSpent] = await Promise.all([
      // Order.countDocuments({ clientId: id }),
      0, // Временно 0, если модель Order еще не создана
      Proposal.countDocuments({ clientId: id }),
      // Order.aggregate([
      //   { $match: { clientId: mongoose.Types.ObjectId(id), status: 'completed' } },
      //   { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      // ]),
      Promise.resolve([{ total: 0 }]) // Временно
    ]);
    
    res.render('admin/client-show', {
      title: `Клиент: ${client.name}`,
      client,
      companyDetails,
      stats: {
        ordersCount,
        proposalsCount,
        totalSpent: totalSpent[0]?.total || 0
      }
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Показать форму редактирования клиента
 */
exports.showEdit = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    
    if (!client) {
      throw new AppError('Клиент не найден', 404);
    }
    
    const companyDetails = await CompanyDetails.findOne({ userId: id });
    
    res.render('admin/client-edit', {
      title: `Редактировать: ${client.name}`,
      client,
      companyDetails,
      csrfToken: res.locals.csrfToken
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Обновить клиента
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, discount, isActive } = req.body;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    
    if (!client) {
      throw new AppError('Клиент не найден', 404);
    }
    
    // Проверка на уникальность email
    if (email && email !== client.email) {
      const existingEmail = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: id } 
      });
      if (existingEmail) {
        throw new AppError('Email уже используется', 400);
      }
      client.email = email.toLowerCase();
    }
    
    // Проверка на уникальность телефона
    if (phone && phone !== client.phone) {
      const existingPhone = await User.findOne({ 
        phone, 
        _id: { $ne: id } 
      });
      if (existingPhone) {
        throw new AppError('Телефон уже используется', 400);
      }
      client.phone = phone;
    }
    
    client.name = name.trim();
    client.discount = discount || 0;
    client.isActive = isActive === 'true' || isActive === true;
    
    await client.save();
    
    req.flash('success', `Клиент ${name} успешно обновлен`);
    res.redirect(`/admin/clients/${id}`);
    
  } catch (err) {
    next(err);
  }
};

/**
 * Деактивировать клиента (мягкое удаление)
 */
exports.deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    
    if (!client) {
      throw new AppError('Клиент не найден', 404);
    }
    
    client.isActive = false;
    await client.save();
    
    req.flash('success', `Клиент ${client.name} деактивирован`);
    
    if (req.xhr) {
      return res.json({ success: true, message: 'Клиент деактивирован' });
    }
    
    res.redirect('/admin/clients');
    
  } catch (err) {
    next(err);
  }
};

/**
 * Активировать клиента
 */
exports.activate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    
    if (!client) {
      throw new AppError('Клиент не найден', 404);
    }
    
    client.isActive = true;
    await client.save();
    
    req.flash('success', `Клиент ${client.name} активирован`);
    
    if (req.xhr) {
      return res.json({ success: true, message: 'Клиент активирован' });
    }
    
    res.redirect('/admin/clients');
    
  } catch (err) {
    next(err);
  }
};

/**
 * Удалить клиента (полное удаление)
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    
    if (!client) {
      throw new AppError('Клиент не найден', 404);
    }
    
    // Проверяем, есть ли у клиента заказы или предложения
    const Proposal = require('../models/Proposal');
    const proposalsCount = await Proposal.countDocuments({ clientId: id });
    
    if (proposalsCount > 0) {
      throw new AppError('Невозможно удалить клиента с существующими предложениями. Деактивируйте его вместо этого.', 400);
    }
    
    // Удаляем связанные данные
    await CompanyDetails.deleteOne({ userId: id });
    
    // Удаляем клиента
    await User.deleteOne({ _id: id });
    
    req.flash('success', `Клиент ${client.name} удален`);
    
    if (req.xhr) {
      return res.json({ success: true, message: 'Клиент удален' });
    }
    
    res.redirect('/admin/clients');
    
  } catch (err) {
    next(err);
  }
};

/**
 * Экспорт клиентов в CSV
 */
exports.exportCSV = async (req, res, next) => {
  try {
    const clients = await User.find({ role: 'client' })
      .select('name email phone discount isVerified isActive createdAt')
      .lean();
    
    const companyDetails = await CompanyDetails.find({
      userId: { $in: clients.map(c => c._id) }
    }).lean();
    
    // Формируем CSV
    let csv = 'Имя,Email,Телефон,Скидка,Верифицирован,Активен,Тип клиента,Компания,ИНН,Дата регистрации\n';
    
    clients.forEach(client => {
      const details = companyDetails.find(d => d.userId.toString() === client._id.toString());
      csv += `"${client.name}",`;
      csv += `"${client.email || ''}",`;
      csv += `"${client.phone || ''}",`;
      csv += `${client.discount},`;
      csv += `${client.isVerified ? 'Да' : 'Нет'},`;
      csv += `${client.isActive ? 'Да' : 'Нет'},`;
      csv += `"${details?.clientType || 'individual'}",`;
      csv += `"${details?.fullName || details?.individual?.fullName || ''}",`;
      csv += `"${details?.inn || ''}",`;
      csv += `"${new Date(client.createdAt).toLocaleDateString('ru-RU')}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clients-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv); // BOM для корректного отображения кириллицы в Excel
    
  } catch (err) {
    next(err);
  }
};

/**
 * Получить статистику по клиентам
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: 'client' } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [{ $match: { isActive: true } }, { $count: 'count' }],
          verified: [{ $match: { isVerified: true } }, { $count: 'count' }],
          byMonth: [
            {
              $group: {
                _id: { 
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ]
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        total: stats[0].total[0]?.count || 0,
        active: stats[0].active[0]?.count || 0,
        verified: stats[0].verified[0]?.count || 0,
        byMonth: stats[0].byMonth
      }
    });
    
  } catch (err) {
    next(err);
  }
};