/**
 * Модель библиотеки технологических схем
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SchemeLibrarySchema = new Schema({
  // ============================================
  // ОСНОВНАЯ ИНФОРМАЦИЯ
  // ============================================
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  // ============================================
  // ИЗОБРАЖЕНИЕ
  // ============================================
  image: {
    type: String,
    required: true
  },
  
  thumbnail: String, // миниатюра для предпросмотра
  
  // ============================================
  // КАТЕГОРИЯ И ТИПЫ
  // ============================================
  category: {
    type: String,
    enum: [
      'iron_removal',        // Обезжелезивание
      'softening',           // Умягчение
      'complex',             // Комплексная очистка
      'reverse_osmosis',     // Обратный осмос
      'aeration',            // Аэрация
      'filtration',          // Механическая фильтрация
      'uv_sterilization',    // УФ-обеззараживание
      'ph_correction',       // Коррекция pH
      'custom'               // Кастомная схема
    ],
    required: true
  },
  
  // Тип системы
  systemType: {
    type: String,
    enum: ['single', 'parallel', 'sequential', 'mixed'],
    default: 'single'
  },
  
  // ============================================
  // ПРИМЕНИМОСТЬ
  // ============================================
  suitableFor: {
    waterSources: [{
      type: String,
      enum: ['well', 'borehole', 'central', 'river', 'spring']
    }],
    
    objectTypes: [{
      type: String,
      enum: ['house', 'dacha', 'apartment', 'commercial', 'production']
    }],
    
    // Условия применения
    conditions: {
      maxIron: Number,
      maxManganese: Number,
      maxHardness: Number,
      minPh: Number,
      maxPh: Number,
      maxFlow: Number, // максимальная производительность (л/ч)
      minFlow: Number  // минимальная производительность (л/ч)
    }
  },
  
  // ============================================
  // ОБОРУДОВАНИЕ В СХЕМЕ
  // ============================================
  equipment: [{
    stage: Number, // номер ступени очистки
    name: String,
    type: {
      type: String,
      enum: [
        'filter',
        'pump',
        'tank',
        'valve',
        'controller',
        'aerator',
        'uv_lamp',
        'membrane',
        'resin_cartridge',
        'other'
      ]
    },
    required: { type: Boolean, default: true },
    optional: { type: Boolean, default: false },
    alternativeOptions: [String], // альтернативные варианты
    notes: String
  }],
  
  // ============================================
  // ХАРАКТЕРИСТИКИ
  // ============================================
  specifications: {
    flowRate: Number, // производительность (л/ч)
    pressure: {
      min: Number, // минимальное давление (бар)
      max: Number  // максимальное давление (бар)
    },
    powerConsumption: Number, // потребляемая мощность (Вт)
    dimensions: {
      width: Number,
      height: Number,
      depth: Number,
      unit: { type: String, default: 'mm' }
    },
    weight: Number, // вес (кг)
    installationSpace: String // требуемое пространство
  },
  
  // ============================================
  // ЭФФЕКТИВНОСТЬ
  // ============================================
  efficiency: {
    ironRemoval: Number, // % удаления железа
    manganeseRemoval: Number,
    hardnessReduction: Number,
    turbidityReduction: Number,
    bacteriaRemoval: Number
  },
  
  // ============================================
  // СТОИМОСТЬ
  // ============================================
  estimatedCost: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'RUB' },
    notes: String // "без учета монтажа", "ориентировочно"
  },
  
  // ============================================
  // ЭКСПЛУАТАЦИЯ
  // ============================================
  maintenance: {
    frequency: String, // "раз в 3 месяца"
    estimatedCost: Number, // стоимость обслуживания/год
    consumables: [{
      name: String,
      replacementPeriod: String, // "каждые 6 месяцев"
      cost: Number
    }]
  },
  
  warranty: {
    equipment: { type: Number, default: 24 }, // месяцы
    installation: { type: Number, default: 12 }
  },
  
  // ============================================
  // ПРЕИМУЩЕСТВА И НЕДОСТАТКИ
  // ============================================
  advantages: [String],
  disadvantages: [String],
  
  // ============================================
  // МЕТАДАННЫЕ
  // ============================================
  tags: [String], // для поиска
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isDefault: {
    type: Boolean,
    default: false // показывать в первую очередь
  },
  
  // Популярность
  usageCount: {
    type: Number,
    default: 0
  },
  
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  // ============================================
  // ФАЙЛЫ И ДОКУМЕНТАЦИЯ
  // ============================================
  files: [{
    type: {
      type: String,
      enum: ['manual', 'certificate', 'specification', 'drawing', 'video']
    },
    url: String,
    name: String,
    uploadedAt: Date
  }],
  
  // Видео с описанием
  videoUrl: String,
  
  // ============================================
  // СОЗДАТЕЛЬ И ПРОВЕРКА
  // ============================================
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  isVerified: {
    type: Boolean,
    default: false // проверена ли схема специалистом
  },
  
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  // ============================================
  // ПРИМЕЧАНИЯ
  // ============================================
  notes: String,
  internalNotes: String, // внутренние заметки (не видны клиенту)
  
  // ============================================
  // СВЯЗАННЫЕ СХЕМЫ
  // ============================================
  relatedSchemes: [{
    type: Schema.Types.ObjectId,
    ref: 'SchemeLibrary'
  }],
  
  // Альтернативы
  alternatives: [{
    schemeId: { type: Schema.Types.ObjectId, ref: 'SchemeLibrary' },
    reason: String // "дешевле", "эффективнее", "для малых объектов"
  }]
  
}, {
  timestamps: true
});

// ============================================
// ВИРТУАЛЬНЫЕ ПОЛЯ
// ============================================

SchemeLibrarySchema.virtual('avgCost').get(function() {
  if (!this.estimatedCost || !this.estimatedCost.min || !this.estimatedCost.max) {
    return null;
  }
  return (this.estimatedCost.min + this.estimatedCost.max) / 2;
});

SchemeLibrarySchema.virtual('isPopular').get(function() {
  return this.usageCount > 10;
});

// ============================================
// ИНДЕКСЫ
// ============================================

SchemeLibrarySchema.index({ category: 1 });
SchemeLibrarySchema.index({ isActive: 1 });
SchemeLibrarySchema.index({ isDefault: 1 });
SchemeLibrarySchema.index({ usageCount: -1 });
SchemeLibrarySchema.index({ rating: -1 });
SchemeLibrarySchema.index({ tags: 1 });
SchemeLibrarySchema.index({ 'suitableFor.waterSources': 1 });
SchemeLibrarySchema.index({ 'suitableFor.objectTypes': 1 });

// ============================================
// СТАТИЧЕСКИЕ МЕТОДЫ
// ============================================

// Поиск подходящих схем по анализу воды
SchemeLibrarySchema.statics.findSuitable = async function(waterAnalysis, objectType, waterSource) {
  const query = {
    isActive: true,
    'suitableFor.waterSources': waterSource,
    'suitableFor.objectTypes': objectType
  };
  
  // Фильтр по условиям
  if (waterAnalysis.iron && waterAnalysis.iron > 0.3) {
    query.$or = [
      { category: 'iron_removal' },
      { category: 'complex' }
    ];
  }
  
  if (waterAnalysis.hardness && waterAnalysis.hardness > 7) {
    if (!query.$or) query.$or = [];
    query.$or.push(
      { category: 'softening' },
      { category: 'complex' }
    );
  }
  
  return this.find(query)
    .sort({ isDefault: -1, usageCount: -1, rating: -1 })
    .limit(10)
    .lean();
};

// Получить популярные схемы
SchemeLibrarySchema.statics.getPopular = async function(limit = 5) {
  return this.find({ isActive: true })
    .sort({ usageCount: -1, rating: -1 })
    .limit(limit)
    .lean();
};

// Поиск по тегам
SchemeLibrarySchema.statics.searchByTags = async function(tags) {
  return this.find({
    isActive: true,
    tags: { $in: tags }
  })
  .sort({ usageCount: -1 })
  .lean();
};

// ============================================
// МЕТОДЫ ЭКЗЕМПЛЯРА
// ============================================

// Увеличить счётчик использования
SchemeLibrarySchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  return this.save();
};

// Проверка применимости для конкретных условий
SchemeLibrarySchema.methods.isSuitableFor = function(waterAnalysis, objectType, waterSource) {
  // Проверка типа объекта
  if (!this.suitableFor.objectTypes.includes(objectType)) {
    return { suitable: false, reason: 'Не подходит для данного типа объекта' };
  }
  
  // Проверка источника воды
  if (!this.suitableFor.waterSources.includes(waterSource)) {
    return { suitable: false, reason: 'Не подходит для данного источника воды' };
  }
  
  // Проверка условий
  const { conditions } = this.suitableFor;
  
  if (conditions) {
    if (conditions.maxIron && waterAnalysis.iron > conditions.maxIron) {
      return { suitable: false, reason: `Превышено содержание железа (макс. ${conditions.maxIron} мг/л)` };
    }
    
    if (conditions.maxManganese && waterAnalysis.manganese > conditions.maxManganese) {
      return { suitable: false, reason: `Превышено содержание марганца (макс. ${conditions.maxManganese} мг/л)` };
    }
    
    if (conditions.maxHardness && waterAnalysis.hardness > conditions.maxHardness) {
      return { suitable: false, reason: `Превышена жёсткость (макс. ${conditions.maxHardness} мг-экв/л)` };
    }
    
    if (conditions.minPh && waterAnalysis.ph < conditions.minPh) {
      return { suitable: false, reason: `Слишком низкий pH (мин. ${conditions.minPh})` };
    }
    
    if (conditions.maxPh && waterAnalysis.ph > conditions.maxPh) {
      return { suitable: false, reason: `Слишком высокий pH (макс. ${conditions.maxPh})` };
    }
  }
  
  return { suitable: true };
};

// ============================================
// MIDDLEWARE
// ============================================

// Установка миниатюры при сохранении
SchemeLibrarySchema.pre('save', function(next) {
  if (this.isModified('image') && !this.thumbnail) {
    // По умолчанию миниатюра = основное изображение
    // В реальности здесь можно генерировать миниатюру
    this.thumbnail = this.image;
  }
  next();
});

// ============================================
// ЭКСПОРТ
// ============================================

module.exports = mongoose.model('SchemeLibrary', SchemeLibrarySchema);
