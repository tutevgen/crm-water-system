const express = require('express');
const router  = express.Router();
const checkRole = require('../middleware/checkRole');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// Multer для аватара
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public', 'img', 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar_${req.session.user._id}_${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Только изображения'));
    cb(null, true);
  }
});
const { escapeRegex, buildSessionUser } = require('../utils/helpers');
const Product = require('../models/admin/Product');
const Category = require('../models/Category');
const ProductLog = require('../models/ProductLog');
const ServiceRequest = require('../models/ServiceRequest');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Proposal = require('../models/Proposal');

// Определение доступных страниц для каждой роли
const roleViews = {
  client: ['dashboard', 'docs', 'history', 'store', 'cart', 'system', 'settings'],
  installer: ['dashboard', 'calendar', 'requests', 'trips', 'settings'],
  manager: ['dashboard', 'calendar', 'clients', 'orders', 'products', 'proposals', 'requests', 'tasks', 'settings', 'system-edit'],
  admin: ['dashboard', 'calendar', 'clients', 'managers', 'orders', 'products', 'proposals', 'requests', 'tasks', 'technicians', 'categories', 'settings']
};

/**
 * Универсальный обработчик панелей
 * /:role/:page
 */
router.get('/:role/:page', checkRole.isAuthenticated, async (req, res, next) => {
  try {
    const { role, page } = req.params;
    const user = req.session.user;
    
    // Проверяем, существует ли такая роль и страница
    if (!roleViews[role] || !roleViews[role].includes(page)) {
      req.flash('error', 'Страница не найдена');
      return res.status(404).render('error/404', {
        title: 'Страница не найдена'
      });
    }
    
    // Проверяем права доступа
    // Пользователь может просматривать только свою панель, кроме админа
    if (user.role !== role && user.role !== 'admin') {
      req.flash('error', 'У вас нет доступа к этой странице');
      return res.status(403).redirect('/forbidden');
    }
    
    // Базовые данные для всех страниц
    const viewData = {
      title: formatPageTitle(page),
      activePage: page,
      user: user,
      csrfToken: res.locals.csrfToken || ''
    };
    
    // Загружаем специфичные данные для определенных страниц
    await loadPageData(page, role, user, viewData, req.query);
    
    // Рендерим представление
    // ВАЖНО: путь pages/${role}/${page} => views/pages/admin/dashboard.ejs
    res.render(`pages/${role}/${page}`, viewData);

  } catch (err) {
    next(err);
  }
});


router.post('/:role/settings', checkRole.isAuthenticated, async (req, res) => {
  try {
    const { role } = req.params;
    const user = req.session.user;
    if (user.role !== role && user.role !== 'admin') {
      return res.status(403).redirect('/forbidden');
    }

    const { tab = 'profile', name, phone, email, currentPassword, newPassword } = req.body;

    if (tab === 'profile') {
      const updates = {};
      if (name?.trim())  updates.name  = name.trim();
      if (phone?.trim()) updates.phone = phone.trim();
      if (email?.trim()) updates.email = email.trim().toLowerCase();

      if (newPassword && newPassword.length >= 6) {
        const bcrypt = require('bcryptjs');
        const dbUser = await User.findById(user._id);
        if (currentPassword) {
          const ok = await bcrypt.compare(currentPassword, dbUser.password);
          if (!ok) {
            req.flash('error', 'Неверный текущий пароль');
            return res.redirect(`/${role}/settings`);
          }
        }
        updates.password = await bcrypt.hash(newPassword, 10);
      }

      // Сохраняем в БД и ВСЕГДА обновляем сессию
      await User.findByIdAndUpdate(user._id, { $set: updates });
      if (name?.trim())  req.session.user.name  = name.trim();
      if (phone?.trim()) req.session.user.phone = phone.trim();
      if (email?.trim()) req.session.user.email = email.trim().toLowerCase();
      await new Promise(r => req.session.save(r)); // Принудительно сохраняем сессию

      req.flash('success', 'Профиль обновлён');
    }

    res.redirect(`/${role}/settings`);
  } catch (err) {
    console.error('Settings save error:', err);
    req.flash('error', 'Ошибка сохранения');
    res.redirect(`/${req.params.role}/settings`);
  }
});


router.post('/:role/settings/avatar', checkRole.isAuthenticated, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const { role } = req.params;
    const user = req.session.user;

    if (!req.file) {
      req.flash('error', 'Файл не выбран');
      return res.redirect(`/${role}/settings`);
    }

    const avatarPath = '/img/avatars/' + req.file.filename;

    // Удалить старый аватар если есть
    if (user.avatar && user.avatar.startsWith('/img/avatars/')) {
      const oldFile = path.join(process.cwd(), 'public', user.avatar);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    await User.findByIdAndUpdate(user._id, { avatar: avatarPath });
    req.session.user.avatar = avatarPath;

    req.flash('success', 'Фото профиля обновлено');
    res.redirect(`/${role}/settings`);
  } catch (err) {
    console.error('Avatar upload error:', err);
    req.flash('error', 'Ошибка загрузки фото');
    res.redirect(`/${req.params.role}/settings`);
  }
});



/**
 * POST /:role/settings — сохранение профиля
 */

/**
 * Загрузка данных в зависимости от страницы
 */
async function loadPageData(page, role, user, viewData, query = {}) {
  switch(page) {
    case 'dashboard':
      viewData.stats = await getDashboardStats(role, user);

      // Для клиента — загружаем смонтированное КП и все КП
      if (role === 'client') {
        const [installedProposal, clientProposals] = await Promise.all([
          Proposal.findOne({
            clientId: user._id,
            status: 'installed'
          }).sort({ installedAt: -1 }).lean(),
          Proposal.find({
            clientId: user._id,
            status: { $in: ['sent','viewed','accepted','accepted_premium','in_progress','installed'] }
          }).sort({ createdAt: -1 }).limit(5).lean()
        ]);
        viewData.installedProposal = installedProposal;
        viewData.proposalsList     = clientProposals;

        if (installedProposal?.managerId) {
          viewData.manager = await User.findById(installedProposal.managerId)
            .select('name phone email avatar').lean();
        } else if (clientProposals[0]?.managerId) {
          viewData.manager = await User.findById(clientProposals[0].managerId)
            .select('name phone email avatar').lean();
        }
      }

      // Для админа/менеджера — мини-календарь, заявки, недоступные сотрудники
      if (role === 'admin' || role === 'manager') {
        const dashNow = new Date();
        const dashYesterday = new Date(dashNow); dashYesterday.setDate(dashYesterday.getDate() - 1);
        dashYesterday.setHours(0,0,0,0);
        const dashWeekEnd = new Date(dashNow); dashWeekEnd.setDate(dashWeekEnd.getDate() + 6);
        dashWeekEnd.setHours(23,59,59,999);

        const [dashRequests, dashProposals, dashReminders, dashUnavailable, dashRecentRequests] = await Promise.all([
          ServiceRequest.find({
            status: { $in: ['new', 'in_progress'] },
            $or: [
              { preferredDate: { $gte: dashYesterday, $lte: dashWeekEnd } },
              { preferredDate: null, createdAt: { $gte: dashYesterday } }
            ]
          }).populate('clientId', 'name phone').populate('assignedTo', 'name').lean(),
          Proposal.find({
            status: { $in: ['accepted', 'accepted_premium', 'in_progress'] }
          }).select('proposalNumber clientName clientPhone objectAddress status acceptedAt createdAt installedBy')
            .populate('installedBy', 'name').lean(),
          Reminder.find({
            date: { $gte: dashYesterday, $lte: dashWeekEnd },
            isCompleted: false
          }).sort({ date: 1 }).lean(),
          User.find({
            role: { $in: ['installer', 'manager'] },
            availability: { $in: ['vacation', 'sick', 'busy', 'day_off'] }
          }).select('name role availability availabilityNote availabilityUntil avatar').lean(),
          ServiceRequest.find({ status: 'new' }).sort({ createdAt: -1 }).limit(5)
            .populate('clientId', 'name phone').lean()
        ]);

        // Мини-календарь: 7 дней
        const miniCalDays = [];
        for (let di = -1; di <= 5; di++) {
          const d = new Date(dashNow); d.setDate(d.getDate() + di);
          const dateStr = d.toISOString().split('T')[0];
          const dayEvents = [];

          dashRequests.forEach(r => {
            const rd = (r.preferredDate || r.createdAt);
            if (rd && rd.toISOString().split('T')[0] === dateStr) {
              dayEvents.push({
                type: 'request', title: r.clientName || r.clientId?.name || 'Заявка',
                url: '/admin/requests', serviceType: r.serviceType
              });
            }
          });
          dashProposals.forEach(p => {
            const pd = (p.acceptedAt || p.createdAt);
            if (pd && pd.toISOString().split('T')[0] === dateStr) {
              dayEvents.push({
                type: 'installation', title: p.proposalNumber + ' ' + (p.clientName || ''),
                url: '/admin/proposals/' + p._id
              });
            }
          });
          dashReminders.forEach(rm => {
            if (rm.date && rm.date.toISOString().split('T')[0] === dateStr) {
              dayEvents.push({
                type: 'reminder', title: rm.title,
                url: rm.linkedUrl || '/admin/calendar', priority: rm.priority
              });
            }
          });

          miniCalDays.push({
            date: d, dateStr, isToday: di === 0, isYesterday: di === -1,
            dayOfWeek: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
            dayNum: d.getDate(),
            events: dayEvents
          });
        }

        viewData.miniCalDays = miniCalDays;
        viewData.unavailableStaff = dashUnavailable;
        viewData.recentRequests = dashRecentRequests;
      }
      break;
      
    case 'products':
      // Получаем параметры фильтрации из query
      const { 
        search = '', 
        category = '', 
        isVisible = '', 
        sort = '',
        page: pageNum = 1 
      } = query;
      
      const limit = 20;
      const skip = (parseInt(pageNum) - 1) * limit;
      
      // Строим фильтр
      const filter = { deletedAt: null };
      
      if (search) {
        filter.$or = [
          { name: new RegExp(escapeRegex(search), 'i') },
          { sku: new RegExp(escapeRegex(search), 'i') }
        ];
      }
      
      if (category) {
        filter.category = category;
      }
      
      if (isVisible === 'true') {
        filter.isVisible = true;
      } else if (isVisible === 'false') {
        filter.isVisible = false;
      }
      
      // Сортировка
      let sortOption = { createdAt: -1 };
      switch(sort) {
        case 'name_asc': sortOption = { name: 1 }; break;
        case 'name_desc': sortOption = { name: -1 }; break;
        case 'price_asc': sortOption = { price: 1 }; break;
        case 'price_desc': sortOption = { price: -1 }; break;
        case 'newest': sortOption = { createdAt: -1 }; break;
        case 'oldest': sortOption = { createdAt: 1 }; break;
      }
      
      // Загружаем данные
      const [products, totalProducts, categories, logs, allProducts] = await Promise.all([
        Product.find(filter)
          .populate('category', 'name')
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
        Category.find({ isActive: true }).lean(),
        ProductLog.find()
          .populate('user', 'name role')
          .populate('product', 'name sku')
          .sort({ timestamp: -1 })
          .limit(50)
          .lean(),
        // Для получения всех ключей характеристик
        Product.find({ deletedAt: null }).select('characteristics').lean()
      ]);
      
      // Собираем все уникальные ключи характеристик
      const charKeysSet = new Set();
      allProducts.forEach(p => {
        if (p.characteristics) {
          Object.keys(p.characteristics).forEach(key => charKeysSet.add(key));
        }
      });
      
      const totalPages = Math.ceil(totalProducts / limit);
      
      viewData.products = products;
      viewData.categories = categories;
      viewData.logs = logs;
      viewData.groupedCategories = buildCategoryTree(categories);
      viewData.allCharKeys = Array.from(charKeysSet);
      
      // Параметры фильтрации для шаблона
      viewData.search = search;
      viewData.category = category;
      viewData.isVisible = isVisible;
      viewData.sort = sort;
      viewData.page = parseInt(pageNum);
      viewData.totalPages = totalPages;
      viewData.totalProducts = totalProducts;
      break;
      
    case 'clients':
      // Загружаем клиентов
      viewData.clients = await User.find({ 
        role: 'client', 
        isActive: true 
      })
      .select('name email phone discount isVerified createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
      break;
      
    case 'managers':
      // Загружаем менеджеров
      viewData.managers = await User.find({ 
        role: 'manager', 
        isActive: true 
      })
      .select('name email phone isVerified createdAt')
      .sort({ createdAt: -1 })
      .lean();
      break;
      
    case 'technicians':
      // Загружаем монтажников с фильтрацией и пагинацией
      const techSearch = query.search || '';
      const techStatus = query.status || '';
      const techAvail = query.availability || '';
      const techPage = parseInt(query.page) || 1;
      const techLimit = 20;
      const techSkip = (techPage - 1) * techLimit;
      
      const techFilter = { role: 'installer' };
      
      if (techSearch) {
        techFilter.$or = [
          { name: new RegExp(escapeRegex(techSearch), 'i') },
          { email: new RegExp(escapeRegex(techSearch), 'i') },
          { phone: new RegExp(escapeRegex(techSearch), 'i') }
        ];
      }
      
      if (techStatus === 'active') techFilter.isActive = true;
      else if (techStatus === 'inactive') techFilter.isActive = false;

      if (techAvail && techAvail !== 'all') techFilter.availability = techAvail;
      
      const [installers, techTotal] = await Promise.all([
        User.find(techFilter)
          .select('name email phone avatar isVerified isActive lastLogin createdAt availability availabilityNote availabilityUntil address')
          .sort({ createdAt: -1 })
          .skip(techSkip)
          .limit(techLimit)
          .lean(),
        User.countDocuments(techFilter)
      ]);
      
      const techTotalPages = Math.ceil(techTotal / techLimit);

      // Для каждого монтажника считаем задачи
      const installersWithStats = await Promise.all(installers.map(async inst => {
        const [activeReqs, activeInstalls, totalCompleted] = await Promise.all([
          ServiceRequest.countDocuments({ assignedTo: inst._id, status: { $in: ['new', 'in_progress'] } }),
          Proposal.countDocuments({ installedBy: inst._id, status: { $in: ['accepted', 'accepted_premium', 'in_progress'] } }),
          Proposal.countDocuments({ installedBy: inst._id, status: 'installed' })
        ]);
        return { ...inst, activeReqs, activeInstalls, totalCompleted };
      }));
      
      // Сообщения из query параметров
      const techSuccessMessages = [];
      const techErrorMessages = [];
      if (query.success === 'created') techSuccessMessages.push('Монтажник успешно создан');
      if (query.success === 'updated') techSuccessMessages.push('Монтажник успешно обновлён');
      if (query.success === 'deleted') techSuccessMessages.push('Монтажник удалён');
      if (query.error === 'not_found') techErrorMessages.push('Монтажник не найден');
      
      viewData.installers = installersWithStats;
      viewData.filters = { search: techSearch, status: techStatus, availability: techAvail };
      viewData.pagination = { page: techPage, totalPages: techTotalPages, total: techTotal };
      viewData.success = techSuccessMessages;
      viewData.error = techErrorMessages;
      break;
      
    case 'proposals':
      // Загружаем коммерческие предложения
      const proposalFilter = {};
      
      if (role === 'client') {
        proposalFilter.clientId = user._id;
      } else if (role === 'manager') {
        proposalFilter.managerId = user._id;
      }
      // Админ видит все
      
      viewData.proposals = await Proposal.find(proposalFilter)
        .populate('clientId', 'name email')
        .populate('managerId', 'name')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      break;
      
    case 'store':
      // Публичный каталог для клиентов
      const [storeProducts, storeCategories] = await Promise.all([
        Product.find({ 
          isVisible: true, 
          isActive: true,
          deletedAt: null 
        })
        .populate('category', 'name slug')
        .sort({ 'metadata.sales': -1 })
        .limit(50)
        .lean(),
        Category.getRootCategories()
      ]);
      
      viewData.products = storeProducts;
      viewData.categories = storeCategories;
      break;

    case 'calendar':
      // Календарь: заявки + монтажи за текущий/следующий месяц
      const calNow = new Date();
      const calStart = new Date(calNow.getFullYear(), calNow.getMonth(), 1);
      const calEnd = new Date(calNow.getFullYear(), calNow.getMonth() + 2, 0);

      const [calRequests, calProposals, calReminders] = await Promise.all([
        ServiceRequest.find({
          status: { $in: ['new', 'in_progress'] }
        }).populate('clientId', 'name phone address').populate('assignedTo', 'name').lean(),
        Proposal.find({
          status: { $in: ['accepted', 'accepted_premium', 'in_progress'] }
        }).select('proposalNumber clientName clientPhone objectAddress status acceptedAt createdAt installedBy')
          .populate('installedBy', 'name').lean(),
        Reminder.find({
          date: { $gte: calStart, $lte: calEnd },
          isCompleted: false
        }).sort({ date: 1 }).lean()
      ]);

      // Формируем события
      const calEvents = [];
      calRequests.forEach(r => {
        calEvents.push({
          id: r._id, type: 'request', status: r.status,
          title: ({ maintenance:'ТО', refill:'Перезасыпка', repair:'Ремонт', analysis:'Анализ', other:'Заявка' })[r.serviceType] || r.serviceType,
          date: r.preferredDate || r.createdAt,
          clientName: r.clientName || r.clientId?.name || '',
          clientPhone: r.clientPhone || r.clientId?.phone || '',
          address: r.clientId?.address || '',
          assignedTo: r.assignedTo?.name || 'Не назначен'
        });
      });
      calProposals.forEach(p => {
        calEvents.push({
          id: p._id, type: 'installation', status: p.status,
          title: 'Монтаж ' + p.proposalNumber,
          date: p.acceptedAt || p.createdAt,
          clientName: p.clientName || '',
          clientPhone: p.clientPhone || '',
          address: p.objectAddress || '',
          assignedTo: p.installedBy?.name || 'Не назначен'
        });
      });
      calEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Добавляем напоминания
      calReminders.forEach(rm => {
        calEvents.push({
          id: rm._id, type: 'reminder', status: 'active',
          title: rm.title,
          date: rm.date,
          clientName: '', clientPhone: '',
          address: rm.description || '',
          assignedTo: rm.createdByName || '',
          linkedUrl: rm.linkedUrl || '',
          priority: rm.priority
        });
      });
      calEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
      viewData.events = calEvents;
      viewData.installers = await User.find({ role: 'installer', isActive: true }).select('name').lean();
      break;

    case 'orders':
      // Заказы = принятые КП
      const ordSearch = query.search || '';
      const ordStatus = query.status || 'all';
      const ordPage = parseInt(query.page) || 1;
      const ordLimit = 20;
      const ordSkip = (ordPage - 1) * ordLimit;

      const ordFilter = {};
      if (ordStatus === 'active') {
        ordFilter.status = { $in: ['accepted', 'accepted_premium', 'in_progress'] };
      } else if (ordStatus === 'installed') {
        ordFilter.status = 'installed';
      } else if (ordStatus !== 'all') {
        ordFilter.status = ordStatus;
      } else {
        ordFilter.status = { $in: ['accepted', 'accepted_premium', 'in_progress', 'installed'] };
      }

      if (ordSearch) {
        ordFilter.$or = [
          { proposalNumber: new RegExp(escapeRegex(ordSearch), 'i') },
          { clientName: new RegExp(escapeRegex(ordSearch), 'i') },
          { clientPhone: new RegExp(escapeRegex(ordSearch), 'i') }
        ];
      }

      const [ordersList, ordTotal] = await Promise.all([
        Proposal.find(ordFilter)
          .populate('clientId', 'name email phone')
          .populate('managerId', 'name')
          .populate('installedBy', 'name')
          .sort({ acceptedAt: -1, createdAt: -1 })
          .skip(ordSkip).limit(ordLimit).lean(),
        Proposal.countDocuments(ordFilter)
      ]);

      const [ordActive, ordInstalled, ordInProgress] = await Promise.all([
        Proposal.countDocuments({ status: { $in: ['accepted', 'accepted_premium'] } }),
        Proposal.countDocuments({ status: 'installed' }),
        Proposal.countDocuments({ status: 'in_progress' })
      ]);

      viewData.orders = ordersList;
      viewData.ordTotal = ordTotal;
      viewData.ordTotalPages = Math.ceil(ordTotal / ordLimit);
      viewData.ordPage = ordPage;
      viewData.ordSearch = ordSearch;
      viewData.ordStatus = ordStatus;
      viewData.ordCounts = { active: ordActive, in_progress: ordInProgress, installed: ordInstalled };
      viewData.installersList = await User.find({ role: { $in: ['installer', 'manager'] }, isActive: true }).select('name role').lean();
      break;

    case 'requests':
      // Заявки на обслуживание
      const reqSearch = query.search || '';
      const reqStatus = query.status || 'all';
      const reqPage = parseInt(query.page) || 1;
      const reqLimit = 20;
      const reqSkip = (reqPage - 1) * reqLimit;

      const reqFilter = {};
      if (reqStatus && reqStatus !== 'all') reqFilter.status = reqStatus;
      if (reqSearch) {
        reqFilter.$or = [
          { clientName: new RegExp(escapeRegex(reqSearch), 'i') },
          { clientPhone: new RegExp(escapeRegex(reqSearch), 'i') },
          { comment: new RegExp(escapeRegex(reqSearch), 'i') }
        ];
      }

      const [reqList, reqTotal] = await Promise.all([
        ServiceRequest.find(reqFilter)
          .populate('clientId', 'name phone email address')
          .populate('assignedTo', 'name')
          .sort({ createdAt: -1 })
          .skip(reqSkip).limit(reqLimit).lean(),
        ServiceRequest.countDocuments(reqFilter)
      ]);

      const [reqCountNew, reqCountInProgress, reqCountCompleted] = await Promise.all([
        ServiceRequest.countDocuments({ status: 'new' }),
        ServiceRequest.countDocuments({ status: 'in_progress' }),
        ServiceRequest.countDocuments({ status: 'completed' })
      ]);

      viewData.requests = reqList;
      viewData.reqTotal = reqTotal;
      viewData.reqTotalPages = Math.ceil(reqTotal / reqLimit);
      viewData.reqPage = reqPage;
      viewData.reqSearch = reqSearch;
      viewData.reqStatus = reqStatus;
      viewData.reqCounts = { new: reqCountNew, in_progress: reqCountInProgress, completed: reqCountCompleted };
      viewData.installersList = await User.find({ role: 'installer', isActive: true }).select('name').lean();
      break;

    case 'tasks':
      // Задачи = заявки + монтажи сгруппированные по монтажникам
      const installersList = await User.find({ role: 'installer', isActive: true })
        .select('name phone email avatar isActive lastLogin').lean();

      // Для каждого монтажника считаем задачи
      const taskData = await Promise.all(installersList.map(async inst => {
        const [activeReqs, activeInstalls, completedMonth] = await Promise.all([
          ServiceRequest.countDocuments({ assignedTo: inst._id, status: { $in: ['new', 'in_progress'] } }),
          Proposal.countDocuments({ installedBy: inst._id, status: { $in: ['accepted', 'accepted_premium', 'in_progress'] } }),
          ServiceRequest.countDocuments({ assignedTo: inst._id, status: 'completed', resolvedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } })
        ]);
        return { ...inst, activeReqs, activeInstalls, completedMonth, totalActive: activeReqs + activeInstalls };
      }));

      // Нераспределённые заявки
      const unassignedReqs = await ServiceRequest.find({ assignedTo: null, status: 'new' })
        .populate('clientId', 'name phone address').sort({ createdAt: -1 }).lean();
      // Нераспределённые монтажи
      const unassignedInstalls = await Proposal.find({ installedBy: null, status: { $in: ['accepted', 'accepted_premium'] } })
        .select('proposalNumber clientName clientPhone objectAddress totalPrice acceptedAt').sort({ acceptedAt: -1 }).lean();

      viewData.taskInstallers = taskData.sort((a, b) => b.totalActive - a.totalActive);
      viewData.unassignedReqs = unassignedReqs;
      viewData.unassignedInstalls = unassignedInstalls;
      break;
      
    case 'categories':
      // Управление категориями (только для админа)
      const allCategories = await Category.find().lean();
      viewData.categories = allCategories;
      viewData.categoryTree = await Category.getTree();
      break;

    case 'settings':
      // Загружаем полные данные текущего пользователя из БД
      viewData.profile = await User.findById(user._id).lean();
      break;
  }
}

/**
 * Получение статистики для дашборда
 */
async function getDashboardStats(role, user) {
  const stats = {};
  
  try {
    switch(role) {
      case 'admin': {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear  = new Date(now.getFullYear(), 0, 1);

        const [
          clientsCount, managersCount, productsCount,
          proposalsTotal, proposalsMonth,
          installedProposals, installedMonth,
          recentProposals
        ] = await Promise.all([
          User.countDocuments({ role: 'client', isActive: true }),
          User.countDocuments({ role: 'manager', isActive: true }),
          Product.countDocuments({ deletedAt: null }),
          Proposal.countDocuments(),
          Proposal.countDocuments({ createdAt: { $gte: startOfMonth } }),
          Proposal.find({ status: 'installed' }).select('acceptedAmount totalPrice installedAt acceptedVariant').lean(),
          Proposal.find({ status: 'installed', installedAt: { $gte: startOfMonth } }).select('acceptedAmount totalPrice').lean(),
          Proposal.find({}).sort({ createdAt: -1 }).limit(8)
            .select('proposalNumber clientName status totalPrice premiumTotal acceptedAmount acceptedVariant createdAt').lean()
        ]);

        // Оборот: сумма всех смонтированных
        const revenueTotal = installedProposals.reduce((s, p) => s + (p.acceptedAmount || p.totalPrice || 0), 0);
        const revenueMonth = installedMonth.reduce((s, p) => s + (p.acceptedAmount || p.totalPrice || 0), 0);

        // Статусы в работе
        const [inWorkCount, pendingCount] = await Promise.all([
          Proposal.countDocuments({ status: { $in: ['accepted','accepted_premium','in_progress'] } }),
          Proposal.countDocuments({ status: { $in: ['sent','viewed'] } })
        ]);

        stats.clients       = clientsCount;
        stats.managers      = managersCount;
        stats.products      = productsCount;
        stats.proposals     = proposalsTotal;
        stats.proposalsMonth= proposalsMonth;
        stats.installed     = installedProposals.length;
        stats.installedMonth= installedMonth.length;
        stats.revenueTotal  = revenueTotal;
        stats.revenueMonth  = revenueMonth;
        stats.inWork        = inWorkCount;
        stats.pending       = pendingCount;
        stats.recentProposals = recentProposals;
        break;
      }
        
      case 'manager':
        // Статистика для менеджера
        const [myClientsCount, myProposalsCount] = await Promise.all([
          User.countDocuments({ role: 'client', isActive: true }),
          Proposal.countDocuments({ managerId: user._id })
        ]);
        
        stats.clients = myClientsCount;
        stats.proposals = myProposalsCount;
        stats.pendingProposals = await Proposal.countDocuments({ 
          managerId: user._id, 
          status: 'sent' 
        });
        break;
        
      case 'client':
        // Статистика для клиента
        const [ordersCount, pendingProposals] = await Promise.all([
          Proposal.countDocuments({ 
            clientId: user._id, 
            status: 'accepted' 
          }),
          Proposal.countDocuments({ 
            clientId: user._id, 
            status: { $in: ['sent', 'viewed'] }
          })
        ]);
        
        stats.orders = ordersCount;
        stats.pendingProposals = pendingProposals;
        break;
        
      case 'installer':
        // Статистика для монтажника
        stats.activeTasks = 0; // TODO: когда будет модель Task
        stats.completedTasks = 0;
        break;
    }
  } catch (err) {
    console.error('Ошибка при загрузке статистики:', err);
  }
  
  return stats;
}

/**
 * Форматирование заголовка страницы
 */
function formatPageTitle(page) {
  const titles = {
    dashboard: 'Панель управления',
    products: 'Товары',
    categories: 'Категории',
    clients: 'Клиенты',
    managers: 'Менеджеры',
    technicians: 'Монтажники',
    orders: 'Заказы',
    proposals: 'Коммерческие предложения',
    requests: 'Заявки',
    tasks: 'Задачи',
    calendar: 'Календарь',
    settings: 'Настройки',
    store: 'Магазин',
    cart: 'Корзина',
    docs: 'Документы',
    history: 'История заказов',
    system: 'Система',
    trips: 'Поездки',
    'system-edit': 'Редактирование системы'
  };
  
  return titles[page] || page.charAt(0).toUpperCase() + page.slice(1);
}

/**
 * Построение дерева категорий
 */
function buildCategoryTree(categories) {
  const tree = [];
  const parentMap = new Map();
  
  // Сначала добавляем родительские категории
  categories.forEach(cat => {
    if (!cat.parent) {
      const group = {
        label: cat.name,
        value: cat._id.toString(),
        options: []
      };
      tree.push(group);
      parentMap.set(cat._id.toString(), group);
    }
  });
  
  // Затем добавляем дочерние категории
  categories.forEach(cat => {
    if (cat.parent) {
      const parentId = cat.parent.toString();
      const parent = parentMap.get(parentId);
      if (parent) {
        parent.options.push(cat);
      }
    }
  });
  
  return tree;
}

/* ============================================================
   ADMIN API — назначение монтажников и управление заявками
============================================================ */

// Назначить монтажника на заявку
router.post('/admin/requests/:id/assign', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { installerId } = req.body;
    const result = await ServiceRequest.findByIdAndUpdate(req.params.id, {
      assignedTo: installerId || null,
      status: installerId ? 'in_progress' : 'new'
    }, { new: true });
    if (!result) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    res.json({ success: true, message: 'Монтажник назначен' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Обновить статус заявки
router.patch('/admin/requests/:id/status', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'completed') update.resolvedAt = new Date();
    if (status === 'cancelled') update.resolvedAt = new Date();
    const result = await ServiceRequest.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!result) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    res.json({ success: true, message: 'Статус обновлён' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Назначить монтажника на монтаж
router.post('/admin/orders/:id/assign', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { installerId } = req.body;
    const result = await Proposal.findByIdAndUpdate(req.params.id, {
      installedBy: installerId || null
    }, { new: true });
    if (!result) return res.status(404).json({ success: false, message: 'Заказ не найден' });
    res.json({ success: true, message: 'Монтажник назначен' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Обновить статус заказа
router.patch('/admin/orders/:id/status', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'in_progress') update.inProgressAt = new Date();
    if (status === 'installed') { update.installedAt = new Date(); update.installNotes = req.body.installNotes || ''; }
    const result = await Proposal.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!result) return res.status(404).json({ success: false, message: 'Заказ не найден' });
    res.json({ success: true, message: 'Статус обновлён' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== НАПОМИНАНИЯ ====================

// Создать напоминание
router.post('/admin/reminders', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { title, description, date, time, linkedType, linkedId, linkedUrl, priority, color, assignedTo } = req.body;
    if (!title || !date) return res.status(400).json({ success: false, message: 'Заполните название и дату' });
    const reminder = new Reminder({
      title, description, date: new Date(date), time,
      linkedType: linkedType || 'custom', linkedId, linkedUrl,
      priority: priority || 'normal', color: color || '#6366f1',
      assignedTo: assignedTo || null,
      createdBy: req.session.user._id,
      createdByName: req.session.user.name
    });
    await reminder.save();
    res.json({ success: true, reminder, message: 'Напоминание создано' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Удалить напоминание
router.delete('/admin/reminders/:id', checkRole('admin', 'manager'), async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Удалено' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Завершить напоминание
router.patch('/admin/reminders/:id/complete', checkRole('admin', 'manager'), async (req, res) => {
  try {
    await Reminder.findByIdAndUpdate(req.params.id, { isCompleted: true, completedAt: new Date() });
    res.json({ success: true, message: 'Выполнено' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== ДОСТУПНОСТЬ СОТРУДНИКОВ ====================

// Обновить статус доступности
router.patch('/admin/users/:id/availability', checkRole('admin', 'manager', 'installer'), async (req, res) => {
  try {
    const { availability, availabilityNote, availabilityUntil } = req.body;
    const userId = req.params.id;
    // Монтажник может менять только свой статус
    if (req.session.user.role === 'installer' && req.session.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Нет доступа' });
    }
    const allowed = ['available', 'busy', 'vacation', 'sick', 'day_off'];
    if (!allowed.includes(availability)) return res.status(400).json({ success: false, message: 'Недопустимый статус' });
    await User.findByIdAndUpdate(userId, {
      availability,
      availabilityNote: availabilityNote || '',
      availabilityUntil: availabilityUntil ? new Date(availabilityUntil) : null
    });
    res.json({ success: true, message: 'Статус обновлён' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== ОБНОВЛЕНИЕ ИСПОЛНИТЕЛЯ ЗАКАЗА ====================

// Обновить исполнителя (монтажник ИЛИ менеджер)
router.post('/admin/orders/:id/executor', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { executorId } = req.body;
    if (!executorId) return res.status(400).json({ success: false, message: 'Выберите исполнителя' });
    const executor = await User.findById(executorId).select('role').lean();
    if (!executor) return res.status(404).json({ success: false, message: 'Исполнитель не найден' });
    await Proposal.findByIdAndUpdate(req.params.id, { installedBy: executorId });
    res.json({ success: true, message: 'Исполнитель назначен' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Обновить дату заявки
router.patch('/admin/requests/:id/date', checkRole('admin', 'manager'), async (req, res) => {
  try {
    const { preferredDate } = req.body;
    await ServiceRequest.findByIdAndUpdate(req.params.id, { preferredDate: preferredDate ? new Date(preferredDate) : null });
    res.json({ success: true, message: 'Дата обновлена' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
