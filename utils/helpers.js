/**
 * Утилиты общего назначения
 */

/**
 * Экранирование спецсимволов RegExp для безопасного поиска
 * Защита от ReDoS атак
 */
function escapeRegex(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Построение объекта пользователя для сессии
 * Единая точка — предотвращает рассинхронизацию данных сессии
 */
function buildSessionUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    discount: user.discount || 0,
    isActive: user.isActive
  };
}

/**
 * Безопасный JSON.stringify для вставки в HTML-атрибуты
 * Предотвращает XSS через данные в data-атрибутах
 */
function safeJsonStringify(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/"/g, '&quot;');
}

module.exports = {
  escapeRegex,
  buildSessionUser,
  safeJsonStringify
};
