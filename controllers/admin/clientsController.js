const { escapeRegex } = require("../../utils/helpers");
const User = require('../../models/User');
const CompanyDetails = require('../../models/CompanyDetails');
const Proposal = require('../../models/Proposal');
// const Order = require('../../models/Order'); // Раскомментировать когда будет модель

/**
 * Список клиентов — FIX #6: clientType фильтруется ДО пагинации
 */
exports.index = async (req, res, next) => {
  try {
    const { search, status, clientType, sort, page = 1, limit = 20 } = req.query;

    // Базовый фильтр
    const filter = { role: 'client' };

    if (search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { email: new RegExp(escapeRegex(search), 'i') },
        { phone: new RegExp(escapeRegex(search), 'i') }
      ];
    }

    if (status === 'active') filter.isActive = true;
    else if (status === 'inactive') filter.isActive = false;
    else if (status === 'new') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filter.createdAt = { $gte: weekAgo };
    }

    // FIX #6: clientType фильтруем через CompanyDetails ДО пагинации
    if (clientType) {
      if (clientType === 'individual') {
        const withDetails = await CompanyDetails.find({
          clientType: { $in: ['company', 'ip'] }
        }).select('userId').lean();
        const excludeIds = withDetails.map(d => d.userId);
        filter._id = { $nin: excludeIds };
      } else {
        const details = await CompanyDetails.find({ clientType }).select('userId').lean();
        filter._id = { $in: details.map(d => d.userId) };
      }
    }

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'oldest': sortOption = { createdAt: 1 }; break;
      case 'name':   sortOption = { name: 1 };      break;
      case 'lastActivity': sortOption = { lastLogin: -1 }; break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [clients, totalClients] = await Promise.all([
      User.find(filter).sort(sortOption).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter)
    ]);

    const clientIds = clients.map(c => c._id);
    const companyDetails = await CompanyDetails.find({ userId: { $in: clientIds } }).lean();

    const clientsWithDetails = clients.map(client => {
      const details = companyDetails.find(d => d.userId.toString() === client._id.toString());
      return { ...client, companyDetails: details || {}, ordersCount: 0 };
    });

    const stats = await getClientsStats();

    res.render('pages/admin/clients', {
      title: 'Клиенты',
      clients: clientsWithDetails,
      totalClients,
      totalPages: Math.ceil(totalClients / parseInt(limit)),
      page: parseInt(page),
      search: search || '',
      status: status || '',
      clientType: clientType || '',
      sort: sort || '',
      stats,
      managers: [],
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    console.error('❌ Ошибка в clients.index:', err);
    next(err);
  }
};

/**
 * Просмотр клиента
 */
exports.show = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'client' })
      .lean();
    
    if (!client) {
      req.flash('error', 'Клиент не найден');
      return res.redirect('/admin/clients');
    }
    
    const [companyDetails, proposals] = await Promise.all([
      CompanyDetails.findOne({ userId: id }).lean(),
      Proposal.find({ clientId: id }).sort({ createdAt: -1 }).limit(10).lean()
    ]);
    
    client.companyDetails = companyDetails || {};
    
    res.render('pages/admin/client-view', {
      title: client.name || 'Клиент',
      client,
      proposals,
      orders: [],
      documents: [],
      interactions: [],
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Форма создания
 */
exports.createForm = async (req, res, next) => {
  try {
    const managers = await User.find({ role: 'manager', isActive: true }).select('name').lean();
    
    res.render('pages/admin/client-form', {
      title: 'Новый клиент',
      client: null,
      managers,
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
    
    const [client, companyDetails, managers] = await Promise.all([
      User.findOne({ _id: id, role: 'client' }).lean(),
      CompanyDetails.findOne({ userId: id }).lean(),
      User.find({ role: 'manager', isActive: true }).select('name').lean()
    ]);
    
    if (!client) {
      req.flash('error', 'Клиент не найден');
      return res.redirect('/admin/clients');
    }
    
    client.companyDetails = companyDetails || {};
    
    res.render('pages/admin/client-form', {
      title: 'Редактирование: ' + client.name,
      client,
      managers,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Создание клиента
 */
exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({ success: false, message: 'Имя обязательно' });
    }
    
    if (!data.email && !data.phone) {
      return res.status(400).json({ success: false, message: 'Укажите email или телефон' });
    }
    
    if (data.email) {
      const existingEmail = await User.findOne({ email: data.email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email уже используется' });
      }
    }
    
    if (data.phone) {
      const existingPhone = await User.findOne({ phone: data.phone });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Телефон уже используется' });
      }
    }
    
    const password = data.password || Math.random().toString(36).slice(-8);
    
    // Создаём User БЕЗ реквизитов (они в CompanyDetails)
    const client = new User({
      name: data.name.trim(),
      email: data.email ? data.email.toLowerCase() : null,
      phone: data.phone || null,
      login: data.email || data.phone,
      isPhone: !data.email,
      password: password,
      role: 'client',
      discount: parseInt(data.discount) || 0,
      isActive: data.isActive !== false,
      isVerified: data.isVerified === true
    });
    
    await client.save();
    
    // Создаём CompanyDetails для реквизитов
    const details = new CompanyDetails({
      userId: client._id,
      clientType: data.clientType || 'individual',
      address: data.address || null,
      city: data.city || null,
      region: data.region || null
    });
    
    // Для юр.лиц и ИП добавляем реквизиты
    if (data.clientType === 'company' || data.clientType === 'ip') {
      details.fullName = data.fullName || null;
      details.inn = data.inn || null;
      details.kpp = data.kpp || null;
      details.ogrn = data.ogrn || null;
      details.director = data.director || null;
      details.legalAddress = data.legalAddress || null;
      details.bankName = data.bankName || null;
      details.bik = data.bik || null;
      details.rs = data.rs || null;
      details.ks = data.ks || null;
    }
    
    await details.save();
    
    if (data.sendCredentials && data.email) {
      // FIX: пароль не логируется
      if (process.env.NODE_ENV === 'development') console.log(`📧 Данные доступа отправлены на ${data.email}`);
    }
    
    res.json({ success: true, clientId: client._id, message: 'Клиент создан' });
  } catch (err) {
    console.error('Ошибка создания клиента:', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Клиент с такими данными уже существует' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Обновление клиента
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const client = await User.findOne({ _id: id, role: 'client' });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Клиент не найден' });
    }
    
    // Проверка уникальности email
    if (data.email && data.email.toLowerCase() !== client.email) {
      const existing = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email уже используется' });
      }
      client.email = data.email.toLowerCase();
    }
    
    // Проверка уникальности телефона
    if (data.phone && data.phone !== client.phone) {
      const existing = await User.findOne({ phone: data.phone, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Телефон уже используется' });
      }
      client.phone = data.phone;
    }
    
    // Обновляем ТОЛЬКО основные поля User (без orgDetails!)
    if (data.name) client.name = data.name.trim();
    if (data.discount !== undefined) client.discount = parseInt(data.discount) || 0;
    if (data.isActive !== undefined) client.isActive = data.isActive;
    if (data.isVerified !== undefined) client.isVerified = data.isVerified;
    
    // ВАЖНО: НЕ трогаем orgDetails в User - они в отдельной модели CompanyDetails!
    // Mongoose может триггерить валидацию, поэтому используем updateOne
    await User.updateOne(
      { _id: id },
      {
        $set: {
          name: client.name,
          email: client.email,
          phone: client.phone,
          discount: client.discount,
          isActive: client.isActive,
          isVerified: client.isVerified
        }
      }
    );
    
    // Реквизиты сохраняем ТОЛЬКО в CompanyDetails
    let details = await CompanyDetails.findOne({ userId: id });
    if (!details) {
      details = new CompanyDetails({ userId: id });
    }
    
    // Тип клиента
    details.clientType = data.clientType || 'individual';
    
    // Адрес для всех типов
    details.address = data.address || null;
    details.city = data.city || null;
    details.region = data.region || null;
    
    // Для юр.лиц и ИП - реквизиты
    if (data.clientType === 'company' || data.clientType === 'ip') {
      details.fullName = data.fullName || null;
      details.inn = data.inn || null;
      details.kpp = data.kpp || null;
      details.ogrn = data.ogrn || null;
      details.director = data.director || null;
      details.legalAddress = data.legalAddress || null;
      details.bankName = data.bankName || null;
      details.bik = data.bik || null;
      details.rs = data.rs || null;
      details.ks = data.ks || null;
    } else {
      // Для физ.лиц очищаем реквизиты
      details.fullName = null;
      details.inn = null;
      details.kpp = null;
      details.ogrn = null;
      details.director = null;
      details.legalAddress = null;
      details.bankName = null;
      details.bik = null;
      details.rs = null;
      details.ks = null;
    }
    
    await details.save();
    
    res.json({ success: true, message: 'Клиент обновлён' });
  } catch (err) {
    console.error('Ошибка обновления клиента:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Активация клиента
 */
exports.activate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await User.updateOne({ _id: id, role: 'client' }, { $set: { isActive: true } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Клиент не найден' });
    }
    res.json({ success: true, message: 'Клиент активирован' });
  } catch (err) {
    next(err);
  }
};

/**
 * Деактивация клиента
 */
exports.deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await User.updateOne({ _id: id, role: 'client' }, { $set: { isActive: false } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Клиент не найден' });
    }
    res.json({ success: true, message: 'Клиент деактивирован' });
  } catch (err) {
    next(err);
  }
};

/**
 * Удаление клиента
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const proposalsCount = await Proposal.countDocuments({ clientId: id });
    if (proposalsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Невозможно удалить клиента с существующими КП' 
      });
    }
    
    await CompanyDetails.deleteOne({ userId: id });
    await User.deleteOne({ _id: id, role: 'client' });
    
    res.json({ success: true, message: 'Клиент удалён' });
  } catch (err) {
    next(err);
  }
};

/**
 * Экспорт в CSV
 */
// FIX #24: потоковый вывод через cursor — не грузим всё в память
exports.exportCSV = async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.write('\uFEFF' + 'Имя;Email;Телефон;Тип;Компания;ИНН;Скидка;Активен;Дата\n');

    const types = { individual: 'Физ.лицо', company: 'Юр.лицо', ip: 'ИП' };
    const cursor = User.find({ role: 'client' })
      .select('name email phone discount isActive createdAt')
      .sort({ name: 1 })
      .lean()
      .cursor();

    for await (const c of cursor) {
      const d = await CompanyDetails.findOne({ userId: c._id }).select('clientType fullName inn').lean() || {};
      const q = (s) => '"' + String(s || '').replace(/"/g, '""') + '"';
      res.write(
        `${q(c.name)};${q(c.email)};${q(c.phone)};` +
        `${q(types[d.clientType] || 'Физ.лицо')};${q(d.fullName)};${q(d.inn)};` +
        `${c.discount || 0};${c.isActive !== false ? 'Да' : 'Нет'};` +
        `${q(c.createdAt ? new Date(c.createdAt).toLocaleDateString('ru-RU') : '')}\n`
      );
    }
    res.end();
  } catch (err) {
    next(err);
  }
};

/**
 * Статистика клиентов
 */
async function getClientsStats() {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  try {
    const [total, active, thisMonth, companies] = await Promise.all([
      User.countDocuments({ role: 'client' }),
      User.countDocuments({ role: 'client', isActive: true }),
      User.countDocuments({ role: 'client', createdAt: { $gte: monthAgo } }),
      CompanyDetails.countDocuments({ clientType: { $in: ['company', 'ip'] } })
    ]);
    return { total, active, companies, thisMonth };
  } catch (err) {
    return { total: 0, active: 0, companies: 0, thisMonth: 0 };
  }
}

exports.getStats = async (req, res, next) => {
  try {
    const stats = await getClientsStats();
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};
