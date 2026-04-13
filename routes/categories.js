const express = require('express');
const router = express.Router();

const categoriesController = require('../controllers/categoriesController');
const checkRole = require('../middleware/checkRole');

// Все роуты требуют авторизации как admin или manager
router.use(checkRole('admin', 'manager'));

// GET /categories - Список категорий (API)
router.get('/', categoriesController.index);

// POST /categories - Создание категории
router.post('/', categoriesController.create);

// GET /categories/:id - Получение категории
router.get('/:id', categoriesController.getById);

// PUT /categories/:id - Обновление категории
router.put('/:id', categoriesController.update);

// DELETE /categories/:id - Удаление категории
router.delete('/:id', categoriesController.delete);

module.exports = router;
