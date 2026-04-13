const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const clientController = require('../../controllers/client/clientController');
const checkRole = require('../../middleware/checkRole');

// Папка для аватаров
const avatarsDir = path.join(__dirname, '../../public/img/avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Недопустимый тип файла'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Все роуты требуют авторизации клиента
router.use(checkRole('client'));

// === СТРАНИЦЫ ===
router.get('/dashboard', clientController.dashboard);
router.get('/settings', clientController.settingsPage);
router.post('/settings', upload.single('avatar'), clientController.saveSettings);
router.get('/system', clientController.systemPage);
router.get('/docs', clientController.docsPage);
router.get('/history', clientController.historyPage);
router.get('/store', clientController.storePage);
router.get('/cart', clientController.cartPage);

// КП
router.get('/proposals', clientController.proposalsPage);
router.get('/proposals/:id', clientController.proposalView);
router.post('/proposals/:id/accept', clientController.acceptProposal);
router.post('/proposals/:id/reject', clientController.rejectProposal);

// === API ===
router.post('/service-request', clientController.serviceRequest);
router.get('/api/product/:id', clientController.getProduct);

module.exports = router;
