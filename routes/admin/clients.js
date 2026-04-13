const express = require('express');
const router = express.Router();
const clientsController = require('../../controllers/admin/clientsController');
const checkRole = require('../../middleware/checkRole');
const csrf = require('csurf');

router.use(checkRole('admin', 'manager'));

// FIX #34: CSRF для state-changing методов
const csrfProtection = csrf({
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
});

// GET — страницы
router.get('/', csrfProtection, clientsController.index);
router.get('/export', clientsController.exportCSV);
router.get('/create', csrfProtection, clientsController.createForm);

// FIX #35: /api/stats ВЫШЕ /:id — иначе Express поймает 'api' как :id
router.get('/api/stats', clientsController.getStats);

router.get('/:id', clientsController.show);
router.get('/:id/edit', csrfProtection, clientsController.editForm);

// POST/PUT/DELETE/PATCH — с CSRF
router.post('/', csrfProtection, clientsController.create);
router.put('/:id', csrfProtection, clientsController.update);
router.delete('/:id', csrfProtection, checkRole('admin'), clientsController.delete);
router.patch('/:id/activate', csrfProtection, clientsController.activate);
router.patch('/:id/deactivate', csrfProtection, clientsController.deactivate);

module.exports = router;
