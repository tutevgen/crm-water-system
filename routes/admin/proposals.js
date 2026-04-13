/**
 * Роуты коммерческих предложений
 * ФИНАЛЬНАЯ ВЕРСИЯ - CSRF проверяется ПОСЛЕ Multer
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csrf = require('csurf');
const proposalController = require('../../controllers/admin/proposalController');
const checkRole = require('../../middleware/checkRole');

// ============================================
// НАСТРОЙКА MULTER ДЛЯ ЗАГРУЗКИ ФАЙЛОВ
// ============================================

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir('./public/uploads/schemes');
ensureDir('./public/uploads/works');
ensureDir('./public/uploads/analysis');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = './public/uploads/';
    if (file.fieldname === 'schemaImageUpload') {
      folder += 'schemes/';
    } else if (file.fieldname === 'workPhotosUpload') {
      folder += 'works/';
    } else if (file.fieldname === 'analysisFile') {
      folder += 'analysis/';
    } else {
      folder += 'misc/';
    }
    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения и PDF'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter
});

const proposalUpload = upload.fields([
  { name: 'schemaImageUpload', maxCount: 1 },
  { name: 'workPhotosUpload', maxCount: 5 },
  { name: 'analysisFile', maxCount: 1 }
]);

// ============================================
// CSRF ЗАЩИТА ДЛЯ ЭТОГО РОУТЕРА
// ============================================

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
});

// ============================================
// MIDDLEWARE ДЛЯ ОБРАБОТКИ MULTIPART + CSRF
// ============================================

/**
 * ПРАВИЛЬНЫЙ ПОРЯДОК:
 * 1. Multer парсит multipart и заполняет req.body
 * 2. CSRF проверяет токен в req.body._csrf
 * 3. Controller обрабатывает запрос
 */
const handleMultipartWithCSRF = [
  // Шаг 1: Multer парсит форму
  (req, res, next) => {
    proposalUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('❌ Multer error:', err);
        req.flash('error', `Ошибка загрузки: ${err.message}`);
        return res.redirect('back');
      } else if (err) {
        console.error('❌ Upload error:', err);
        req.flash('error', err.message);
        return res.redirect('back');
      }
      
      console.log('✅ Multer: req.body заполнен, ключей:', Object.keys(req.body).length);
      console.log('✅ Multer: _csrf присутствует?', '_csrf' in req.body ? 'ДА' : 'НЕТ');
      next();
    });
  },
  // Шаг 2: CSRF проверяет токен (req.body уже заполнен!)
  csrfProtection
];

// ============================================
// РОУТЫ
// ============================================

// Все роуты требуют авторизации admin или manager
router.use(checkRole('admin', 'manager'));

// ============================================
// GET РОУТЫ (с обычным CSRF)
// ============================================

// Список КП
router.get('/', csrfProtection, proposalController.index);

// Форма создания
router.get('/create', csrfProtection, proposalController.createForm);

// API endpoints (без CSRF)
router.get('/api/products', proposalController.searchProducts);
router.get('/api/client/:id', proposalController.getClientData);

// Просмотр КП
router.get('/:id', csrfProtection, proposalController.show);

// Форма редактирования
router.get('/:id/edit', csrfProtection, proposalController.editForm);

// Генерация PDF/Печать (GET — CSRF не нужен)
router.get('/:id/pdf', proposalController.generatePDF);

// POST РОУТЫ (с multipart - CSRF ПОСЛЕ Multer)

// Создание КП (Multer → CSRF → Controller)
router.post('/', handleMultipartWithCSRF, proposalController.create);
// FIX #9: router.post('/create') удалён — дублировал POST /

// Обновление КП (Multer → CSRF → Controller)
router.post('/:id', handleMultipartWithCSRF, proposalController.update);

// POST РОУТЫ (без multipart - обычный CSRF)

// Отправка клиенту
router.post('/:id/send', csrfProtection, proposalController.send);

// FIX #16: admin/manager тоже могут принять/отклонить за клиента (например по телефону)
router.post('/:id/accept', csrfProtection, proposalController.accept);
router.post('/:id/reject', csrfProtection, proposalController.reject);

// Дублирование
router.post('/:id/duplicate', csrfProtection, proposalController.duplicate);

// Удаление
router.delete('/:id', csrfProtection, proposalController.delete);
router.post('/:id/delete', csrfProtection, proposalController.delete);

// Смена статуса (редактирование, смена варианта, монтаж)
router.post('/:id/status', csrfProtection, proposalController.setStatus);

module.exports = router;