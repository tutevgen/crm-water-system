/**
 * Контроллер панели монтажника
 * Работает с ServiceRequest (заявки) и Proposal (выезды на монтаж)
 */
const ServiceRequest = require('../models/ServiceRequest');
const Proposal = require('../models/Proposal');
const User = require('../models/User');
const { escapeRegex, buildSessionUser } = require('../utils/helpers');

/* ============================================================
   DASHBOARD
============================================================ */
exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfWeek = new Date(now); endOfWeek.setDate(endOfWeek.getDate() + 7);

    const [
      activeRequests,
      completedMonth,
      totalCompleted,
      upcomingRequests,
      activeInstallations,
      completedInstallations
    ] = await Promise.all([
      // Активные заявки
      ServiceRequest.countDocuments({ assignedTo: userId, status: { $in: ['new', 'in_progress'] } }),
      // Выполнено за месяц
      ServiceRequest.countDocuments({ assignedTo: userId, status: 'completed', resolvedAt: { $gte: startOfMonth } }),
      // Всего выполнено
      ServiceRequest.countDocuments({ assignedTo: userId, status: 'completed' }),
      // Ближайшие заявки (на неделю)
      ServiceRequest.find({ assignedTo: userId, status: { $in: ['new', 'in_progress'] } })
        .populate('clientId', 'name phone address')
        .sort({ preferredDate: 1, createdAt: -1 }).limit(5).lean(),
      // Активные монтажи
      Proposal.find({ installedBy: userId, status: { $in: ['accepted', 'accepted_premium', 'in_progress'] } })
        .select('proposalNumber clientName clientPhone objectAddress status items totalPrice createdAt')
        .sort({ createdAt: -1 }).limit(5).lean(),
      // Завершённые монтажи за месяц
      Proposal.countDocuments({ installedBy: userId, status: 'installed', installedAt: { $gte: startOfMonth } })
    ]);

    res.render('pages/installer/dashboard', {
      title: 'Панель монтажника',
      stats: {
        activeRequests,
        completedMonth,
        totalCompleted,
        activeInstallations: activeInstallations.length,
        completedInstallations
      },
      upcomingRequests,
      activeInstallations,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) { next(err); }
};

/* ============================================================
   ЗАЯВКИ НА ОБСЛУЖИВАНИЕ
============================================================ */
exports.requests = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { status, search, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const filter = { assignedTo: userId };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { clientName: new RegExp(escapeRegex(search), 'i') },
        { clientPhone: new RegExp(escapeRegex(search), 'i') },
        { comment: new RegExp(escapeRegex(search), 'i') }
      ];
    }

    const [requests, total] = await Promise.all([
      ServiceRequest.find(filter)
        .populate('clientId', 'name phone email address')
        .sort({ status: 1, preferredDate: 1, createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      ServiceRequest.countDocuments(filter)
    ]);

    // Счётчики по статусам
    const [countNew, countInProgress, countCompleted] = await Promise.all([
      ServiceRequest.countDocuments({ assignedTo: userId, status: 'new' }),
      ServiceRequest.countDocuments({ assignedTo: userId, status: 'in_progress' }),
      ServiceRequest.countDocuments({ assignedTo: userId, status: 'completed' })
    ]);

    res.render('pages/installer/requests', {
      title: 'Заявки на обслуживание',
      requests,
      total,
      totalPages: Math.ceil(total / limit),
      page: parseInt(page),
      status: status || 'all',
      search: search || '',
      counts: { new: countNew, in_progress: countInProgress, completed: countCompleted },
      csrfToken: res.locals.csrfToken
    });
  } catch (err) { next(err); }
};

/** Обновить статус заявки */
exports.updateRequest = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { id } = req.params;
    const { status, resolvedComment } = req.body;

    const request = await ServiceRequest.findOne({ _id: id, assignedTo: userId });
    if (!request) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    const allowed = { new: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'] };
    if (!allowed[request.status]?.includes(status)) {
      return res.status(400).json({ success: false, message: 'Недопустимый переход статуса' });
    }

    request.status = status;
    if (status === 'completed') {
      request.resolvedAt = new Date();
      request.resolvedComment = resolvedComment || '';
    }
    await request.save();

    res.json({ success: true, message: 'Статус обновлён' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ВЫЕЗДЫ (МОНТАЖИ)
============================================================ */
exports.trips = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { status } = req.query;

    const filter = { installedBy: userId };
    if (status === 'active') {
      filter.status = { $in: ['accepted', 'accepted_premium', 'in_progress'] };
    } else if (status === 'completed') {
      filter.status = 'installed';
    } else {
      filter.status = { $in: ['accepted', 'accepted_premium', 'in_progress', 'installed'] };
    }

    const proposals = await Proposal.find(filter)
      .select('proposalNumber proposalType clientName clientPhone clientEmail objectAddress objectType waterSource residents items premiumItems acceptedVariant totalPrice premiumTotal acceptedAmount status pipingMaterialName services warrantyEquipment createdAt acceptedAt installedAt installNotes schemaImage')
      .sort({ status: 1, createdAt: -1 }).lean();

    // Считаем сумму монтажей за месяц
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedThisMonth = proposals.filter(p => p.status === 'installed' && p.installedAt >= startOfMonth);
    const revenueMonth = completedThisMonth.reduce((s, p) => s + (p.acceptedAmount || p.totalPrice || 0), 0);

    res.render('pages/installer/trips', {
      title: 'Мои выезды',
      proposals,
      statusFilter: status || 'all',
      stats: {
        active: proposals.filter(p => ['accepted', 'accepted_premium', 'in_progress'].includes(p.status)).length,
        completed: proposals.filter(p => p.status === 'installed').length,
        revenueMonth
      },
      csrfToken: res.locals.csrfToken
    });
  } catch (err) { next(err); }
};

/** Обновить статус монтажа */
exports.updateTrip = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { id } = req.params;
    const { status, installNotes } = req.body;

    const proposal = await Proposal.findOne({ _id: id, installedBy: userId });
    if (!proposal) return res.status(404).json({ success: false, message: 'Выезд не найден' });

    if (status === 'in_progress' && ['accepted', 'accepted_premium'].includes(proposal.status)) {
      proposal.status = 'in_progress';
    } else if (status === 'installed' && proposal.status === 'in_progress') {
      proposal.status = 'installed';
      proposal.installedAt = new Date();
      proposal.installNotes = installNotes || '';
    } else {
      return res.status(400).json({ success: false, message: 'Недопустимый переход статуса' });
    }

    await proposal.save();
    res.json({ success: true, message: 'Статус обновлён' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   КАЛЕНДАРЬ
============================================================ */
exports.calendar = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    // Заявки с датами
    const requests = await ServiceRequest.find({
      assignedTo: userId,
      status: { $in: ['new', 'in_progress'] }
    }).populate('clientId', 'name phone address').lean();

    // Монтажи
    const installations = await Proposal.find({
      installedBy: userId,
      status: { $in: ['accepted', 'accepted_premium', 'in_progress'] }
    }).select('proposalNumber clientName clientPhone objectAddress status createdAt acceptedAt').lean();

    // Формируем события для календаря
    const events = [];

    requests.forEach(r => {
      events.push({
        id: r._id,
        title: `${({ maintenance: 'ТО', refill: 'Перезасыпка', repair: 'Ремонт', analysis: 'Анализ', other: 'Заявка' })[r.serviceType] || r.serviceType}: ${r.clientName || 'Клиент'}`,
        date: r.preferredDate || r.createdAt,
        type: 'request',
        status: r.status,
        clientName: r.clientName || r.clientId?.name || '',
        clientPhone: r.clientPhone || r.clientId?.phone || '',
        address: r.clientId?.address || '',
        comment: r.comment || ''
      });
    });

    installations.forEach(p => {
      events.push({
        id: p._id,
        title: `Монтаж ${p.proposalNumber}: ${p.clientName || 'Клиент'}`,
        date: p.acceptedAt || p.createdAt,
        type: 'installation',
        status: p.status,
        clientName: p.clientName || '',
        clientPhone: p.clientPhone || '',
        address: p.objectAddress || ''
      });
    });

    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render('pages/installer/calendar', {
      title: 'Календарь',
      events,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) { next(err); }
};

/* ============================================================
   НАСТРОЙКИ — переиспользуем панельный обработчик
============================================================ */
exports.settings = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    res.render('pages/installer/settings', {
      title: 'Настройки',
      profile: user,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) { next(err); }
};
