const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csrf = require('csurf');

const productsController = require('../../controllers/admin/productsController');
const checkRole = require('../../middleware/checkRole');

// Папка для загрузок
const uploadDir = path.join(__dirname, '../../public/uploads/products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 100000) + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg','image/jpg','image/png','image/gif','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Недопустимый тип файла'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'galleryFiles', maxCount: 20 },
  { name: 'documentFiles', maxCount: 10 }
]);

// FIX #34: CSRF защита для state-changing методов
// Товары отправляются как multipart — CSRF проверяется ПОСЛЕ Multer
const csrfProtection = csrf({
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
});

// Мидлвар: Multer → затем CSRF (для multipart форм)
const uploadWithCsrf = [
  (req, res, next) => {
    uploadFields(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  csrfProtection
];

router.use(checkRole('admin', 'manager'));

// Категории (ВЫШЕ :id!)
router.get('/categories', productsController.getCategories);
router.post('/categories', csrfProtection, productsController.createCategory);
router.put('/categories/:id', csrfProtection, productsController.updateCategory);
router.delete('/categories/:id', csrfProtection, checkRole('admin'), productsController.deleteCategory);

// Характеристики и экспорт
router.get('/characteristics/values', productsController.getCharValues);
router.get('/export/csv', productsController.exportCSV);

// Страницы
router.get('/', csrfProtection, productsController.index);
router.get('/create', csrfProtection, productsController.createForm);
router.get('/:id/edit', csrfProtection, productsController.editForm);
router.get('/:id', productsController.getById);

// API — создание и обновление (multipart → CSRF)
router.post('/', uploadWithCsrf, productsController.create);
router.put('/:id', uploadWithCsrf, productsController.update);

// Остальные state-changing
router.delete('/:id', csrfProtection, productsController.delete);
router.post('/:id/restore', csrfProtection, checkRole('admin'), productsController.restoreProduct);
router.post('/:id/duplicate', csrfProtection, productsController.duplicate);
router.patch('/:id/visibility', csrfProtection, productsController.toggleVisibility);
router.delete('/:id/gallery/:imageId', csrfProtection, productsController.deleteGalleryImage);
router.patch('/:id/gallery/:imageId/main', csrfProtection, productsController.setMainImage);
router.delete('/:id/documents/:docId', csrfProtection, productsController.deleteDocument);

// Быстрое обновление категории КП для товара (inline на странице списка)
router.post('/:id/proposal-category', csrfProtection, productsController.setProposalCategory);

// Активировать все товары (для отладки/восстановления)
router.post('/activate-all', csrfProtection, productsController.activateAll);

module.exports = router;
