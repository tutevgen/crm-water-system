const ServiceRequest = require("../../models/ServiceRequest");
const nodemailer = require("nodemailer");
const _mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
const User = require('../../models/User');
const CompanyDetails = require('../../models/CompanyDetails');
const Proposal = require('../../models/Proposal');
const Product = require('../../models/admin/Product');
const Category = require('../../models/Category');
const { escapeRegex, buildSessionUser } = require('../../utils/helpers');
const path = require('path');
const fs = require('fs');

/* ============================================================
   HELPERS
============================================================ */

/** Берём установленное КП (или последнее принятое) для системы */
async function getInstalledProposal(userId) {
  // Сначала ищем смонтированное
  let proposal = await Proposal.findOne({ clientId: userId, status: 'installed' })
    .sort({ installedAt: -1 }).lean();
  // Если нет — принятое
  if (!proposal) {
    proposal = await Proposal.findOne({ clientId: userId, status: { $in: ['accepted', 'accepted_premium', 'in_progress'] } })
      .sort({ acceptedAt: -1 }).lean();
  }
  return proposal;
}

/** Строим компоненты системы из позиций КП */
function buildSystemComponents(proposal) {
  if (!proposal) return [];
  const items = proposal.acceptedVariant === 'premium'
    ? (proposal.premiumItems || proposal.items || [])
    : (proposal.items || []);

  const iconMap = {
    'аэрац': 'wind', 'обезжелез': 'droplet', 'умягч': 'droplets',
    'осмос': 'glass-water', 'уф': 'sun', 'стерилиз': 'sun',
    'фильтр': 'filter', 'картридж': 'filter', 'бак': 'box',
    'колонн': 'cylinder', 'компресс': 'cpu'
  };

  return items.map(item => {
    let icon = 'package';
    const lower = (item.name || '').toLowerCase();
    for (const [key, val] of Object.entries(iconMap)) {
      if (lower.includes(key)) { icon = val; break; }
    }
    return {
      name: item.name,
      description: item.description || '',
      sku: item.sku || '',
      quantity: item.quantity || 1,
      price: item.price || 0,
      image: item.image || '',
      icon
    };
  });
}

/** Расписание обслуживания по компонентам */
function buildServiceSchedule(proposal) {
  if (!proposal) return [];
  const baseDate = proposal.installedAt ? new Date(proposal.installedAt) : new Date();
  const items = proposal.acceptedVariant === 'premium'
    ? (proposal.premiumItems || proposal.items || [])
    : (proposal.items || []);

  const schedule = [];
  const now = new Date();

  items.forEach(item => {
    const lower = (item.name || '').toLowerCase();
    let intervalMonths = null;
    let intervalText = '';

    if (lower.includes('картридж') || lower.includes('bb10') || lower.includes('bb20')) {
      intervalMonths = 2; intervalText = '1-2 месяца';
    } else if (lower.includes('соль') || lower.includes('солевой')) {
      intervalMonths = 2; intervalText = '1-2 месяца';
    } else if (lower.includes('уф') || lower.includes('стерилиз') || lower.includes('лампа')) {
      intervalMonths = 12; intervalText = '1 год';
    } else if (lower.includes('мембран')) {
      intervalMonths = 24; intervalText = '2 года';
    } else if (lower.includes('загрузк') || lower.includes('смола')) {
      intervalMonths = 48; intervalText = '3-5 лет';
    }

    if (intervalMonths) {
      const nextDate = new Date(baseDate);
      // Рассчитываем ближайшую дату замены от даты установки
      while (nextDate <= now) { nextDate.setMonth(nextDate.getMonth() + intervalMonths); }
      schedule.push({
        component: item.name,
        interval: intervalText,
        lastDate: new Date(nextDate.getTime() - intervalMonths * 30 * 24 * 60 * 60 * 1000),
        nextDate,
        isOverdue: nextDate < now
      });
    }
  });

  // Плановое ТО каждые 6 месяцев
  const nextTO = new Date(baseDate);
  while (nextTO <= now) { nextTO.setMonth(nextTO.getMonth() + 6); }
  schedule.push({
    component: 'Плановое ТО системы',
    interval: '6 месяцев',
    lastDate: new Date(nextTO.getTime() - 6 * 30 * 24 * 60 * 60 * 1000),
    nextDate: nextTO,
    isOverdue: nextTO < now
  });

  schedule.sort((a, b) => a.nextDate - b.nextDate);
  return schedule;
}

/* ============================================================
   DASHBOARD
============================================================ */
exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const [user, companyDetails, installedProposal, proposals, serviceRequests] = await Promise.all([
      User.findById(userId).lean(),
      CompanyDetails.findOne({ userId }).lean(),
      getInstalledProposal(userId),
      Proposal.find({ clientId: userId, status: { $in: ['sent', 'viewed', 'accepted', 'accepted_premium', 'in_progress', 'installed'] } })
        .sort({ createdAt: -1 }).limit(5).lean(),
      ServiceRequest.find({ clientId: userId }).sort({ createdAt: -1 }).limit(3).lean()
    ]);

    // Менеджер из КП
    let manager = null;
    if (installedProposal?.managerId) {
      manager = await User.findById(installedProposal.managerId).select('name phone email avatar').lean();
    } else if (proposals[0]?.managerId) {
      manager = await User.findById(proposals[0].managerId).select('name phone email avatar').lean();
    }

    // Информация о системе из установленного КП
    let systemInfo = null;
    if (installedProposal) {
      const items = installedProposal.acceptedVariant === 'premium'
        ? (installedProposal.premiumItems || installedProposal.items || [])
        : (installedProposal.items || []);
      const installedDate = installedProposal.installedAt ? new Date(installedProposal.installedAt) : null;
      const warrantyMonths = installedProposal.warrantyEquipment || 24;
      let warrantyUntil = null;
      if (installedDate) { warrantyUntil = new Date(installedDate); warrantyUntil.setMonth(warrantyUntil.getMonth() + warrantyMonths); }

      const schedule = buildServiceSchedule(installedProposal);
      const nextService = schedule.length ? schedule[0].nextDate : null;

      systemInfo = {
        model: items.map(i => i.name).join(', ').substring(0, 80) + (items.length > 2 ? '...' : ''),
        status: 'active',
        installedAt: installedDate,
        warrantyUntil,
        nextServiceAt: nextService,
        photo: installedProposal.schemaImage || '/uploads/systems/system_image.jpg',
        description: items.map(i => i.name).join(' + ')
      };
    }

    // Расписание обслуживания
    const services = buildServiceSchedule(installedProposal).slice(0, 4);

    res.render('pages/client/dashboard', {
      title: 'Личный кабинет',
      user,
      companyDetails,
      systemInfo,
      installedProposal,
      proposalsList: proposals,
      manager,
      orders: [],
      services,
      serviceRequests,
      notificationsList: [],
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    console.error('Ошибка client.dashboard:', err);
    next(err);
  }
};

/* ============================================================
   СИСТЕМА ВОДООЧИСТКИ — реальные данные из КП
============================================================ */
exports.systemPage = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const proposal = await getInstalledProposal(userId);

    if (!proposal) {
      return res.render('pages/client/system', {
        title: 'Моя система',
        systemInfo: null,
        systemComponents: [],
        services: [],
        history: [],
        waterAnalysis: null,
        csrfToken: res.locals.csrfToken
      });
    }

    const items = proposal.acceptedVariant === 'premium'
      ? (proposal.premiumItems || proposal.items || [])
      : (proposal.items || []);
    const installedDate = proposal.installedAt ? new Date(proposal.installedAt) : new Date();
    const warrantyEq = proposal.warrantyEquipment || 24;
    const warrantyInst = proposal.warrantyInstallation || 24;
    const warrantyUntilEq = new Date(installedDate); warrantyUntilEq.setMonth(warrantyUntilEq.getMonth() + warrantyEq);
    const warrantyUntilInst = new Date(installedDate); warrantyUntilInst.setMonth(warrantyUntilInst.getMonth() + warrantyInst);

    const totalAmount = proposal.acceptedAmount || proposal.totalPrice || 0;

    const systemInfo = {
      proposalNumber: proposal.proposalNumber,
      model: items.map(i => i.name).join(' + '),
      status: proposal.status === 'installed' ? 'active' : 'installing',
      installedAt: installedDate,
      warrantyUntilEquipment: warrantyUntilEq,
      warrantyUntilInstallation: warrantyUntilInst,
      totalAmount,
      managerName: proposal.managerName,
      managerPhone: proposal.managerPhone,
      objectAddress: proposal.objectAddress,
      objectType: proposal.objectType,
      waterSource: proposal.waterSource,
      photo: proposal.schemaImage || '/uploads/systems/system_image.jpg',
      workPhotos: proposal.workPhotos || [],
      pipingMaterial: proposal.pipingMaterialName || 'Полипропилен'
    };

    const systemComponents = buildSystemComponents(proposal);
    const services = buildServiceSchedule(proposal);

    // История обслуживания из заявок
    const completedRequests = await ServiceRequest.find({
      clientId: userId, status: 'completed'
    }).sort({ resolvedAt: -1 }).limit(10).lean();

    const history = completedRequests.map(r => ({
      title: { maintenance: 'Плановое ТО', refill: 'Перезасыпка', repair: 'Ремонт', analysis: 'Анализ воды', other: 'Обслуживание' }[r.serviceType] || r.serviceType,
      description: r.resolvedComment || r.comment || '',
      date: r.resolvedAt || r.updatedAt,
      cost: 0
    }));

    // Добавляем монтаж как первую запись в историю
    if (proposal.installedAt) {
      history.push({
        title: 'Монтаж системы водоочистки',
        description: `Установка: ${items.map(i => i.name).join(', ')}`,
        date: installedDate,
        cost: totalAmount
      });
    }
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render('pages/client/system', {
      title: 'Моя система',
      systemInfo,
      systemComponents,
      services,
      history,
      waterAnalysis: proposal.waterAnalysis || null,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   ДОКУМЕНТЫ — реальные КП + файлы
============================================================ */
exports.docsPage = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    // Все КП клиента
    const proposals = await Proposal.find({ clientId: userId })
      .select('proposalNumber proposalType status totalPrice premiumTotal acceptedVariant acceptedAmount createdAt sentAt items waterAnalysis')
      .sort({ createdAt: -1 }).lean();

    // Разбиваем по типам документов
    const proposalDocs = proposals.map(p => ({
      _id: p._id,
      name: `${p.proposalNumber} — ${p.proposalType === 'refill' ? 'Перезасыпка' : p.proposalType === 'maintenance' ? 'ТО' : p.proposalType === 'repair' ? 'Ремонт' : 'Установка'}`,
      type: 'proposal',
      status: p.status,
      amount: p.acceptedAmount || p.totalPrice || 0,
      date: p.sentAt || p.createdAt,
      url: `/client/proposals/${p._id}`
    }));

    // Анализы воды из КП
    const analysisDocs = proposals
      .filter(p => p.waterAnalysis?.file)
      .map(p => ({
        name: `Анализ воды — ${p.proposalNumber}`,
        type: 'analysis',
        date: p.createdAt,
        url: p.waterAnalysis.file
      }));

    // Заявки на обслуживание (как акты)
    const serviceReqs = await ServiceRequest.find({ clientId: userId, status: 'completed' })
      .sort({ resolvedAt: -1 }).lean();
    const actDocs = serviceReqs.map(r => ({
      name: `${{ maintenance: 'ТО', refill: 'Перезасыпка', repair: 'Ремонт', analysis: 'Анализ', other: 'Обслуживание' }[r.serviceType] || r.serviceType} — ${new Date(r.resolvedAt || r.updatedAt).toLocaleDateString('ru-RU')}`,
      type: 'act',
      date: r.resolvedAt || r.updatedAt,
      description: r.resolvedComment || ''
    }));

    res.render('pages/client/docs', {
      title: 'Документы',
      contractsList: [], // TODO: модель Contract
      proposalsList: proposalDocs,
      instructionsList: [], // TODO: инструкции к оборудованию
      certificatesList: [], // TODO: сертификаты
      actsList: actDocs,
      analysisList: analysisDocs,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   ИСТОРИЯ — заявки на обслуживание + заказы
============================================================ */
exports.historyPage = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const [serviceRequests, proposals] = await Promise.all([
      ServiceRequest.find({ clientId: userId }).sort({ createdAt: -1 }).lean(),
      Proposal.find({ clientId: userId })
        .select('proposalNumber proposalType status totalPrice acceptedAmount createdAt acceptedAt installedAt')
        .sort({ createdAt: -1 }).lean()
    ]);

    res.render('pages/client/history', {
      title: 'История',
      serviceRequests,
      proposals,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   МАГАЗИН — реальный каталог товаров
============================================================ */
exports.storePage = async (req, res, next) => {
  try {
    const { search, category, sort: sortParam, page = 1 } = req.query;
    const limit = 12;
    const skip = (parseInt(page) - 1) * limit;
    const userDiscount = req.session.user?.discount || 0;

    const filter = { isVisible: true, isActive: true, deletedAt: null };
    if (search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { description: new RegExp(escapeRegex(search), 'i') }
      ];
    }
    if (category) filter.category = category;

    let sortOption = { 'metadata.sales': -1 };
    switch (sortParam) {
      case 'price_asc': sortOption = { price: 1 }; break;
      case 'price_desc': sortOption = { price: -1 }; break;
      case 'name': sortOption = { name: 1 }; break;
      case 'newest': sortOption = { createdAt: -1 }; break;
    }

    const [products, totalProducts, categories] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').sort(sortOption).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
      Category.find({ isActive: true }).sort({ name: 1 }).lean()
    ]);

    res.render('pages/client/store', {
      title: 'Магазин',
      products,
      categories,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limit),
      page: parseInt(page),
      search: search || '',
      category: category || '',
      sort: sortParam || '',
      userDiscount,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   КОРЗИНА
============================================================ */
exports.cartPage = async (req, res, next) => {
  try {
    res.render('pages/client/cart', {
      title: 'Корзина',
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   НАСТРОЙКИ
============================================================ */
exports.settingsPage = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const [user, companyDetails] = await Promise.all([
      User.findById(userId).lean(),
      CompanyDetails.findOne({ userId }).lean()
    ]);
    res.render('pages/client/settings', {
      title: 'Настройки профиля',
      user,
      companyDetails: companyDetails || {},
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    next(err);
  }
};

exports.saveSettings = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const data = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Пользователь не найден' });

    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: userId } });
      if (existing) return res.status(400).json({ success: false, message: 'Email уже используется' });
    }
    if (data.phone && data.phone !== user.phone) {
      const existing = await User.findOne({ phone: data.phone, _id: { $ne: userId } });
      if (existing) return res.status(400).json({ success: false, message: 'Телефон уже используется' });
    }

    if (req.file) {
      if (user.avatar) {
        const oldPath = path.join(__dirname, '../../public/img/avatars', path.basename(user.avatar));
        if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (e) {} }
      }
      user.avatar = '/img/avatars/' + req.file.filename;
    }

    if (data.name) user.name = data.name.trim();
    if (data.email) user.email = data.email.toLowerCase();
    if (data.phone) user.phone = data.phone;

    if (data.newPassword && data.currentPassword) {
      const isMatch = await user.comparePassword(data.currentPassword);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Неверный текущий пароль' });
      if (data.newPassword !== data.confirmPassword) return res.status(400).json({ success: false, message: 'Пароли не совпадают' });
      if (data.newPassword.length < 6) return res.status(400).json({ success: false, message: 'Пароль должен быть не короче 6 символов' });
      user.password = data.newPassword;
    }

    await user.save();

    let details = await CompanyDetails.findOne({ userId });
    if (!details) details = new CompanyDetails({ userId });
    details.clientType = data.clientType || 'individual';
    details.address = data.address || null;
    details.city = data.city || null;
    details.region = data.region || null;
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

    // FIX: единая функция обновления сессии
    req.session.user = buildSessionUser(user);

    res.json({ success: true, message: 'Настройки сохранены', user: { name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error('Ошибка сохранения настроек:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   КП
============================================================ */
exports.proposalsPage = async (req, res, next) => {
  try {
    const proposals = await Proposal.find({ clientId: req.session.user._id }).sort({ createdAt: -1 }).lean();
    res.render('pages/client/history', { title: 'Коммерческие предложения', serviceRequests: [], proposals, csrfToken: res.locals.csrfToken });
  } catch (err) { next(err); }
};

exports.proposalView = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const proposal = await Proposal.findOne({ _id: req.params.id, clientId: userId }).lean();
    if (!proposal) { req.flash('error', 'Предложение не найдено'); return res.redirect('/client/dashboard'); }
    if (proposal.status === 'sent') {
      await Proposal.updateOne({ _id: req.params.id }, { status: 'viewed', viewedAt: new Date(), $inc: { viewCount: 1 } });
    }
    res.render('pages/admin/proposals/proposal-view', { title: proposal.proposalNumber, p: proposal, proposal, isClientView: true, csrfToken: res.locals.csrfToken });
  } catch (err) { next(err); }
};

exports.acceptProposal = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const proposal = await Proposal.findOne({ _id: req.params.id, clientId: userId });
    if (!proposal) return res.status(404).json({ success: false, message: 'Не найдено' });
    if (!['sent', 'viewed'].includes(proposal.status)) return res.status(400).json({ success: false, message: 'Невозможно принять' });
    const { variant, comment } = req.body;
    proposal.status = variant === 'premium' ? 'accepted_premium' : 'accepted';
    proposal.acceptedVariant = variant === 'premium' ? 'premium' : 'standard';
    proposal.acceptedAmount = variant === 'premium' ? (proposal.premiumTotal || proposal.totalPrice) : proposal.totalPrice;
    proposal.acceptedAt = new Date();
    proposal.acceptedBy = userId;
    proposal.clientComment = comment || '';
    await proposal.save();
    // TODO: уведомить менеджера по email/SMS
    res.json({ success: true, message: 'Предложение принято!' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejectProposal = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const proposal = await Proposal.findOne({ _id: req.params.id, clientId: userId });
    if (!proposal) return res.status(404).json({ success: false, message: 'Не найдено' });
    if (!['sent', 'viewed'].includes(proposal.status)) return res.status(400).json({ success: false, message: 'Невозможно отклонить' });
    proposal.status = 'rejected';
    proposal.rejectedAt = new Date();
    proposal.rejectedBy = userId;
    proposal.rejectReason = req.body.reason || '';
    await proposal.save();
    res.json({ success: true, message: 'Предложение отклонено' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

/* ============================================================
   ЗАЯВКА НА ОБСЛУЖИВАНИЕ
============================================================ */
exports.serviceRequest = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { serviceType, preferredDate, comment } = req.body;
    if (!serviceType) return res.status(400).json({ success: false, message: 'Выберите тип обслуживания' });

    const client = await User.findById(userId).select('name phone').lean();

    const request = new ServiceRequest({
      clientId: userId,
      clientName: client?.name || '',
      clientPhone: client?.phone || '',
      serviceType,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      comment: comment?.trim() || '',
      status: 'new'
    });
    await request.save();

    // Уведомляем менеджеров
    const typeLabels = { maintenance: 'Плановое ТО', refill: 'Перезасыпка', repair: 'Ремонт', analysis: 'Анализ воды', other: 'Другое' };
    const managers = await User.find({ role: { $in: ['manager', 'admin'] }, isActive: true }).select('email').lean();
    const emails = managers.map(m => m.email).filter(Boolean);

    if (emails.length) {
      try {
        await _mailer.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || 'CRM'}" <${process.env.SMTP_USER}>`,
          to: emails.join(','),
          subject: `Новая заявка на обслуживание от ${client?.name || 'клиента'}`,
          html: `<h2>Заявка #${request._id}</h2>
            <p><b>Клиент:</b> ${client?.name || '—'} (${client?.phone || '—'})</p>
            <p><b>Тип:</b> ${typeLabels[serviceType] || serviceType}</p>
            <p><b>Дата:</b> ${preferredDate ? new Date(preferredDate).toLocaleDateString('ru-RU') : 'не указана'}</p>
            <p><b>Комментарий:</b> ${comment || '—'}</p>`
        });
      } catch (mailErr) {
        console.error('⚠️ Ошибка email:', mailErr.message);
      }
    }

    res.json({ success: true, message: 'Заявка принята. Менеджер свяжется с вами.' });
  } catch (err) {
    console.error('Ошибка создания заявки:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   API — Товары для корзины
============================================================ */
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isVisible: true, isActive: true, deletedAt: null })
      .select('name price photo sku unit description').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Товар не найден' });
    res.json({ success: true, product });
  } catch (err) { next(err); }
};
