const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/installerPanelController');
const checkRole = require('../../middleware/checkRole');

router.use(checkRole('installer'));

// Страницы
router.get('/dashboard', ctrl.dashboard);
router.get('/requests', ctrl.requests);
router.get('/trips', ctrl.trips);
router.get('/calendar', ctrl.calendar);
router.get('/settings', ctrl.settings);

// API — смена статусов
router.patch('/requests/:id/status', ctrl.updateRequest);
router.patch('/trips/:id/status', ctrl.updateTrip);

module.exports = router;
