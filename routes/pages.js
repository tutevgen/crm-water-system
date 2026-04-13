const express = require('express');
const router = express.Router();
const checkRole = require('../middleware/checkRole');
const mainController = require('../controllers/mainController');

/**
 * Публичные страницы (без авторизации)
 */

// Главная страница (лендинг)
router.get('/', mainController.index);

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

// Обработка контактной формы
router.post('/contacts', mainController.submitContactForm);

/**
 * API endpoints
 */

// Поиск товаров (автозаполнение)
router.get('/api/search', mainController.searchProducts);

// Переключение темы
router.post('/api/theme/toggle', mainController.toggleTheme);

// Healthcheck
router.get('/health', mainController.healthCheck);

/**
 * Служебные страницы
 */

// Страница "Доступ запрещен" (403)
router.get('/forbidden', mainController.forbidden);

// Страница организационных деталей (если нужна отдельная)
router.get('/org-details', checkRole.isAuthenticated, (req, res) => {
  res.render('pages/orgDetails', {
    title: 'Реквизиты компании',
    user: req.session.user
  });
});

module.exports = router;