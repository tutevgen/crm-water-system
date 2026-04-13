// config/navConfig.js

module.exports = {
  icons: {
    dashboard: 'home',
    docs: 'file-text',
    history: 'clock',
    store: 'shopping-cart',
    calendar: 'calendar-days',
    clients: 'users',
    orders: 'clipboard-list',
    products: 'package',
    proposals: 'file-check',
    requests: 'inbox',
    tasks: 'check-circle',
    trips: 'map-pin',
    managers: 'briefcase',
    technicians: 'wrench',
    settings: 'settings',
    system: 'settings'
  },
  links: {
    client: [
      { href: 'dashboard', label: 'Главная' },
      { href: 'docs', label: 'Документация' },
      { href: 'history', label: 'История' },
      { href: 'store', label: 'Продукция' },
      { href: 'system', label: 'Система' }
    ],
    installer: [
      { href: 'dashboard', label: 'Главная' },
      { href: 'calendar', label: 'Календарь' },
      { href: 'requests', label: 'Заявки' },
      { href: 'trips', label: 'Мои выезды' },
      { href: 'settings', label: 'Настройки' }
    ],
    manager: [
      { href: 'dashboard', label: 'Главная' },
      { href: 'calendar', label: 'Календарь' },
      { href: 'clients', label: 'Клиенты' },
      { href: 'orders', label: 'Заказы' },
      { href: 'products', label: 'Продукция' },
      { href: 'proposals', label: 'Коммерческие предложения' },
      { href: 'requests', label: 'Заявки' },
      { href: 'tasks', label: 'Задачи' },
      { href: 'settings', label: 'Настройки' }
    ],
    admin: [
      { href: 'dashboard', label: 'Главная' },
      { href: 'calendar', label: 'Календарь' },
      { href: 'clients', label: 'Клиенты' },
      { href: 'managers', label: 'Менеджеры' },
      { href: 'orders', label: 'Заказы' },
      { href: 'products', label: 'Продукция' },
      { href: 'proposals', label: 'Коммерческие предложения' },
      { href: 'requests', label: 'Заявки' },
      { href: 'tasks', label: 'Задачи' },
      { href: 'technicians', label: 'Монтажники' },
      { href: 'settings', label: 'Настройки' }
    ]
  }
};