const express = require('express');
const router = express.Router();
const checkRole = require('../middleware/checkRole');
const proposalController = require('../controllers/admin/proposalController');
const Proposal = require('../models/Proposal');

// FIX: Middleware проверки доступа клиента к КП (защита от IDOR)
const checkProposalAccess = async (req, res, next) => {
  try {
    const user = req.session?.user;
    if (!user) return res.redirect('/login');
    
    // Админ и менеджер видят все
    if (user.role === 'admin' || user.role === 'manager') return next();
    
    // Клиент видит только свои КП
    if (user.role === 'client') {
      const proposal = await Proposal.findById(req.params.id).select('clientId').lean();
      if (!proposal) {
        req.flash('error', 'КП не найдено');
        return res.redirect('/proposals');
      }
      if (proposal.clientId.toString() !== user._id.toString()) {
        req.flash('error', 'У вас нет доступа к этому КП');
        return res.redirect('/proposals');
      }
    }
    
    next();
  } catch (err) {
    next(err);
  }
};

// FIX #15: Этот файл — только клиентские действия с КП (просмотр, принятие, отклонение)

// Список КП (для клиента — только его)
router.get('/', checkRole('admin', 'manager', 'client'), proposalController.index);

// Просмотр КП — FIX: добавлена проверка IDOR
router.get('/:id', checkRole('admin', 'manager', 'client'), checkProposalAccess, proposalController.show);

// Принятие КП клиентом — FIX: добавлена проверка IDOR
router.post('/:id/accept', checkRole('client'), checkProposalAccess, proposalController.accept);

// Отклонение КП клиентом — FIX: добавлена проверка IDOR
router.post('/:id/reject', checkRole('client'), checkProposalAccess, proposalController.reject);

// Генерация PDF — FIX: добавлена проверка IDOR
router.get('/:id/pdf', checkRole('admin', 'manager', 'client'), checkProposalAccess, proposalController.generatePDF);

module.exports = router;
