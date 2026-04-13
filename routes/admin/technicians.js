const express = require('express');
const router = express.Router();
const installerController = require('../../controllers/installerController');
const checkRole = require('../../middleware/checkRole');
const csrf = require('csurf');
const User = require('../../models/User');
const Proposal = require('../../models/Proposal');
const ServiceRequest = require('../../models/ServiceRequest');

router.use(checkRole('admin'));

const csrfProtection = csrf({
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
});

router.get('/', installerController.index);
router.get('/create', csrfProtection, installerController.showCreate);
router.post('/', csrfProtection, installerController.create);
router.get('/:id/edit', csrfProtection, installerController.showEdit);
router.post('/:id', csrfProtection, installerController.update);
router.post('/:id/toggle-status', csrfProtection, installerController.toggleStatus);
router.delete('/:id', csrfProtection, installerController.delete);
router.get('/:id/json', installerController.getById);

// =============== ДЕТАЛЬНАЯ СТРАНИЦА МОНТАЖНИКА ===============
router.get('/:id/view', async (req, res, next) => {
  try {
    const { id } = req.params;
    const installer = await User.findOne({ _id: id, role: 'installer' })
      .select('name email phone avatar isVerified isActive lastLogin createdAt address availability availabilityNote availabilityUntil')
      .lean();

    if (!installer) {
      req.flash('error', 'Монтажник не найден');
      return res.redirect('/admin/technicians');
    }

    // Все монтажи (КП)
    const [installations, activeInstalls, serviceRequests, activeReqs] = await Promise.all([
      Proposal.find({ installedBy: id })
        .select('proposalNumber proposalType clientName clientPhone objectAddress status totalPrice premiumTotal acceptedAmount acceptedVariant acceptedAt installedAt installNotes items premiumItems pipingMaterialName')
        .sort({ createdAt: -1 })
        .lean(),
      Proposal.countDocuments({ installedBy: id, status: { $in: ['accepted', 'accepted_premium', 'in_progress'] } }),
      ServiceRequest.find({ assignedTo: id })
        .populate('clientId', 'name phone address')
        .sort({ createdAt: -1 })
        .lean(),
      ServiceRequest.countDocuments({ assignedTo: id, status: { $in: ['new', 'in_progress'] } })
    ]);

    // Статистика
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const completedInstalls = installations.filter(p => p.status === 'installed');
    const completedMonth = completedInstalls.filter(p => p.installedAt && new Date(p.installedAt) >= startOfMonth);
    const completedYear = completedInstalls.filter(p => p.installedAt && new Date(p.installedAt) >= startOfYear);

    const revenueTotal = completedInstalls.reduce((s, p) => s + (p.acceptedAmount || p.totalPrice || 0), 0);
    const revenueMonth = completedMonth.reduce((s, p) => s + (p.acceptedAmount || p.totalPrice || 0), 0);
    const revenueYear = completedYear.reduce((s, p) => s + (p.acceptedAmount || p.totalPrice || 0), 0);

    const completedReqs = serviceRequests.filter(r => r.status === 'completed');
    const completedReqsMonth = completedReqs.filter(r => r.resolvedAt && new Date(r.resolvedAt) >= startOfMonth);

    const stats = {
      totalInstalls: completedInstalls.length,
      monthInstalls: completedMonth.length,
      yearInstalls: completedYear.length,
      activeInstalls,
      activeReqs,
      totalReqs: completedReqs.length,
      monthReqs: completedReqsMonth.length,
      revenueTotal,
      revenueMonth,
      revenueYear
    };

    res.render('pages/admin/technician-view', {
      title: installer.name,
      installer,
      installations,
      serviceRequests,
      stats,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) { next(err); }
});

module.exports = router;
