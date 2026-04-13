/**
 * Конфигурация коммерческих предложений
 * config/proposalConfig.js
 */

// Материалы обвязки
const PIPING_MATERIALS = {
  polypropylene: {
    code: 'polypropylene',
    name: 'Полипропилен',
    description: 'Полипропиленовые трубы и фитинги — стандартное решение',
    basePrice: 8000,
    pricePerMeter: 350,
    advantages: [
      'Низкая стоимость',
      'Простой монтаж',
      'Не подвержен коррозии',
      'Срок службы 50+ лет'
    ],
    disadvantages: [
      'Ограничение по температуре (+95°C)',
      'Менее эстетичный вид'
    ]
  },
  polypropylene_metal_valves: {
    code: 'polypropylene_metal_valves',
    name: 'Полипропилен + латунные краны',
    description: 'Трубы ПП, но запорная арматура из латуни',
    basePrice: 12000,
    pricePerMeter: 450,
    advantages: [
      'Надёжная запорная арматура',
      'Долговечность кранов',
      'Оптимальное соотношение цена/качество'
    ],
    disadvantages: [
      'Дороже стандартного ПП'
    ]
  },
  stainless_steel: {
    code: 'stainless_steel',
    name: 'Нержавеющая сталь',
    description: 'Полностью нержавеющая обвязка — премиум решение',
    basePrice: 25000,
    pricePerMeter: 1200,
    advantages: [
      'Максимальная долговечность',
      'Эстетичный внешний вид',
      'Гигиеничность',
      'Устойчивость к высоким температурам'
    ],
    disadvantages: [
      'Высокая стоимость',
      'Сложнее монтаж'
    ]
  },
  copper: {
    code: 'copper',
    name: 'Медная труба',
    description: 'Медная обвязка — премиум класс',
    basePrice: 30000,
    pricePerMeter: 1500,
    advantages: [
      'Антибактериальные свойства',
      'Долговечность',
      'Премиальный вид'
    ],
    disadvantages: [
      'Высокая цена',
      'Требует квалифицированного монтажа'
    ]
  }
};

// Рекомендуемые опции (не входят в основную сумму)
const RECOMMENDED_OPTIONS = {
  uv_sterilizer: {
    code: 'uv_sterilizer',
    name: 'УФ-стерилизатор',
    price: 12500,
    description: 'Обеззараживание воды ультрафиолетом',
    advantages: [
      'Уничтожение 99.9% бактерий',
      'Без химикатов',
      'Не меняет вкус воды'
    ],
    category: 'safety'
  },
  leak_protection: {
    code: 'leak_protection',
    name: 'Защита от протечек',
    price: 8500,
    description: 'Автоматическое перекрытие воды при протечке',
    advantages: [
      'Защита от затопления',
      'Датчики + электрокран',
      'Оповещение на телефон'
    ],
    category: 'safety'
  },
  thermal_cover: {
    code: 'thermal_cover',
    name: 'Термочехол для баллонов',
    price: 4500,
    description: 'Утепление баллонов для неотапливаемых помещений',
    advantages: [
      'Защита от замерзания',
      'Продление срока службы',
      'Эстетичный вид'
    ],
    category: 'protection'
  },
  ro_system: {
    code: 'ro_system',
    name: 'Обратный осмос (питьевая вода)',
    price: 18900,
    description: 'Система для получения идеально чистой питьевой воды',
    advantages: [
      'Идеальная очистка для питья',
      'Отдельный кран на кухне',
      'Удаление 99% примесей'
    ],
    category: 'drinking'
  },
  bypass: {
    code: 'bypass',
    name: 'Байпас (обходная линия)',
    price: 3200,
    description: 'Возможность подачи воды в обход системы',
    advantages: [
      'Удобство обслуживания',
      'Аварийное водоснабжение',
      'Быстрое переключение'
    ],
    category: 'convenience'
  },
  pressure_tank: {
    code: 'pressure_tank',
    name: 'Гидроаккумулятор 50л',
    price: 6800,
    description: 'Дополнительный бак для стабилизации давления',
    advantages: [
      'Стабильное давление',
      'Меньше включений насоса',
      'Запас воды'
    ],
    category: 'convenience'
  },
  salt_tank_large: {
    code: 'salt_tank_large',
    name: 'Увеличенный солевой бак',
    price: 4200,
    description: 'Бак для соли 100л вместо стандартного',
    advantages: [
      'Реже досыпать соль',
      'Удобство обслуживания'
    ],
    category: 'convenience'
  },
  remote_monitoring: {
    code: 'remote_monitoring',
    name: 'Удалённый мониторинг',
    price: 15000,
    description: 'GSM-модуль для контроля системы через приложение',
    advantages: [
      'Контроль 24/7',
      'Уведомления о неисправностях',
      'Статистика потребления'
    ],
    category: 'smart'
  }
};

// Готовые комплекты/бандлы
const BUNDLES = {
  basic_iron: {
    name: 'Базовый (обезжелезивание)',
    description: 'Для воды с повышенным содержанием железа',
    suitableFor: ['high_iron'],
    components: ['iron_filter', 'sediment_filter'],
    priceFrom: 45000
  },
  basic_hardness: {
    name: 'Базовый (умягчение)',
    description: 'Для жёсткой воды',
    suitableFor: ['high_hardness'],
    components: ['softener', 'sediment_filter'],
    priceFrom: 42000
  },
  standard: {
    name: 'Стандарт',
    description: 'Комплексная очистка для большинства случаев',
    suitableFor: ['high_iron', 'high_hardness'],
    components: ['iron_filter', 'softener', 'sediment_filter'],
    priceFrom: 75000
  },
  premium: {
    name: 'Премиум',
    description: 'Полная очистка + питьевая вода',
    suitableFor: ['high_iron', 'high_hardness', 'bacteria'],
    components: ['aeration', 'iron_filter', 'softener', 'carbon_filter', 'ro_system', 'uv_sterilizer'],
    priceFrom: 150000
  }
};

// Типы КП
const PROPOSAL_TYPES = {
  installation: {
    code: 'installation',
    name: 'Установка системы водоочистки',
    description: 'Полная установка новой системы',
    requiresAnalysis: true,
    requiresScheme: true,
    requiresWorkPhotos: true
  },
  refill: {
    code: 'refill',
    name: 'Перезасыпка загрузок',
    description: 'Замена фильтрующих материалов',
    requiresAnalysis: false,
    requiresScheme: false,
    requiresWorkPhotos: true
  },
  maintenance: {
    code: 'maintenance',
    name: 'Техническое обслуживание',
    description: 'Плановое ТО системы',
    requiresAnalysis: false,
    requiresScheme: false,
    requiresWorkPhotos: false
  },
  repair: {
    code: 'repair',
    name: 'Ремонт системы',
    description: 'Диагностика и ремонт',
    requiresAnalysis: false,
    requiresScheme: false,
    requiresWorkPhotos: false
  }
};

// Функция для получения рекомендаций по анализу воды
function getRecommendedOptionsFor(waterAnalysis) {
  const recommendations = [];
  
  // Если есть бактерии или сероводород — рекомендуем УФ
  if (waterAnalysis.hydrogen_sulfide > 0.003) {
    recommendations.push('uv_sterilizer');
  }
  
  // Всегда рекомендуем защиту от протечек
  recommendations.push('leak_protection');
  
  // Если жёсткость высокая — увеличенный солевой бак
  if (waterAnalysis.hardness > 10) {
    recommendations.push('salt_tank_large');
  }
  
  // Рекомендуем обратный осмос для питья
  recommendations.push('ro_system');
  
  return recommendations;
}

// Стандартные услуги
const DEFAULT_SERVICES = {
  delivery: {
    name: 'Доставка',
    description: 'До 50км бесплатно',
    defaultPrice: 0,
    defaultEnabled: true
  },
  installation: {
    name: 'Монтаж под ключ',
    description: 'Полный монтаж нашими специалистами',
    defaultPrice: 15000,
    defaultEnabled: true
  },
  chiefInstallation: {
    name: 'Шеф-монтаж онлайн',
    description: 'Удалённая консультация по видеосвязи',
    defaultPrice: 6000,
    defaultEnabled: false
  },
  commissioning: {
    name: 'Пуско-наладка',
    description: 'Настройка и запуск системы',
    defaultPrice: 3000,
    defaultEnabled: true
  },
  materials: {
    name: 'Обвязочные материалы',
    description: 'Трубы, фитинги, крепёж',
    defaultPrice: 12500,
    defaultEnabled: true
  }
};

// Стандартные включения в стоимость
const DEFAULT_INCLUDES = [
  { key: 'delivery', label: 'Бесплатная доставка', default: true },
  { key: 'analysis', label: 'Анализ воды после установки', default: true },
  { key: 'consumables', label: 'Расходные материалы на 1 месяц', default: true },
  { key: 'first_service', label: 'Первое ТО бесплатно (в течение 3 месяцев)', default: true },
  { key: 'protection', label: 'Термозащита баллонов', default: false },
  { key: 'leak_protection', label: 'Система защиты от протечек', default: false },
  { key: 'training', label: 'Обучение эксплуатации', default: false }
];

module.exports = {
  PIPING_MATERIALS,
  RECOMMENDED_OPTIONS,
  BUNDLES,
  PROPOSAL_TYPES,
  DEFAULT_SERVICES,
  DEFAULT_INCLUDES,
  getRecommendedOptionsFor
};
