const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

/**
 * Главная страница
 * GET /
 */
router.get('/', mainController.index);

/**
 * Публичные страницы
 */

// О компании
router.get('/about', mainController.about);

// Контакты
router.get('/contacts', mainController.contacts);

// Услуги
router.get('/services', mainController.services);

// Каталог товаров (публичный)
router.get('/catalog', mainController.catalog);

// Детальная страница товара
router.get('/product/:slug', mainController.productDetail);

/**
 * Обработка форм
 */

// Отправка контактной формы
router.post('/contacts', mainController.submitContactForm);

/**
 * Служебные страницы
 */

// Страница 403 — доступ запрещён
router.get('/forbidden', mainController.forbidden);

// Страница 404 — не найдено (используется для явного редиректа)
router.get('/not-found', (req, res) => {
  res.status(404).render('error/404', {
    title: 'Страница не найдена',
    activePage: 'not-found'
  });
});

/**
 * API endpoints
 */

// Поиск товаров (для автозаполнения)
router.get('/api/search', mainController.searchProducts);

// Переключение темы
router.post('/api/theme/toggle', mainController.toggleTheme);

// Healthcheck
router.get('/health', mainController.healthCheck);

// Проверка статуса API
router.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;