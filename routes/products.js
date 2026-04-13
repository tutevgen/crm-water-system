const express = require('express');
const router = express.Router();
const productsController = require('../controllers/admin/productsController');
const checkRole = require('../middleware/checkRole');
const multer = require('multer');
const path = require('path');

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/products/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * Товары - только для админов и менеджеров
 */

// Список товаров с фильтрами
router.get('/', 
  checkRole('admin', 'manager'),
  productsController.listProducts
);

// Создание товара
router.post('/',
  checkRole('admin', 'manager'),
  upload.single('photo'),
  productsController.createProduct
);

// Обновление товара
router.put('/:id',
  checkRole('admin', 'manager'),
  upload.single('photo'),
  productsController.updateProduct
);

// Удаление товара (мягкое)
router.delete('/:id',
  checkRole('admin', 'manager'),
  productsController.deleteProduct
);

// Восстановление товара
router.post('/:id/restore',
  checkRole('admin'),
  productsController.restoreProduct
);

// Переключение видимости
router.patch('/:id/visibility',
  checkRole('admin', 'manager'),
  productsController.toggleVisibility
);

// Получение значений характеристик
router.get('/characteristics/values',
  checkRole('admin', 'manager'),
  productsController.getCharValues
);

// Экспорт в CSV
router.get('/export/csv',
  checkRole('admin', 'manager'),
  productsController.exportCSV
);

/**
 * Категории
 */

// Получить все категории
router.get('/categories',
  checkRole('admin', 'manager'),
  productsController.getCategories
);

// Создать категорию
router.post('/categories',
  checkRole('admin', 'manager'),
  productsController.createCategory
);

// Обновить категорию
router.put('/categories/:id',
  checkRole('admin', 'manager'),
  productsController.updateCategory
);

// Удалить категорию
router.delete('/categories/:id',
  checkRole('admin'),
  productsController.deleteCategory
);

module.exports = router;