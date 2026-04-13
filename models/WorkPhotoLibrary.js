/**
 * Модель библиотеки фотографий выполненных работ
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WorkPhotoLibrarySchema = new Schema({
  // ============================================
  // ОСНОВНАЯ ИНФОРМАЦИЯ
  // ============================================
  title: {
    type: String,
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
  
  imageSize: {
    width: Number,
    height: Number,
    fileSize: Number // в байтах
  },
  
  // ============================================
  // КАТЕГОРИЗАЦИЯ
  // ============================================
  category: {
    type: String,
    enum: [
      'before_after',        // До/После
      'installation',        // Монтаж
      'equipment',          // Оборудование
      'scheme',             // Схема подключения
      'location',           // Размещение системы
      'commissioning',      // Пусконаладка
      'maintenance',        // Обслуживание
      'complex',            // Комплексная система
      'other'
    ],
    default: 'installation'
  },
  
  // Тип работы
  workType: {
    type: String,
    enum: [
      'new_installation',   // Новая установка
      'replacement',        // Замена
      'upgrade',           // Модернизация
      'repair',            // Ремонт
      'maintenance'        // Обслуживание
    ]
  },
  
  // ============================================
  // ЛОКАЦИЯ
  // ============================================
  location: {
    region: String,
    city: String,
    objectType: {
      type: String,
      enum: ['house', 'dacha', 'apartment', 'commercial', 'production']
    }
  },
  
  // ============================================
  // ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ
  // ============================================
  installedEquipment: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    manufacturer: String,
    category: String
  }],
  
  systemType: {
    type: String,
    enum: [
      'iron_removal',
      'softening',
      'complex',
      'reverse_osmosis',
      'aeration',
      'filtration',
      'uv_sterilization'
    ]
  },
  
  // Материал обвязки
  pipingMaterial: {
    type: String,
    enum: ['polypropylene', 'metal', 'stainless_steel', 'mixed']
  },
  
  // ============================================
  // ДЕТАЛИ ПРОЕКТА
  // ============================================
  projectDetails: {
    waterSource: {
      type: String,
      enum: ['well', 'borehole', 'central', 'river', 'spring']
    },
    
    problemsSolved: [{
      type: String,
      enum: [
        'high_iron',
        'high_manganese',
        'high_hardness',
        'hydrogen_sulfide',
        'turbidity',
        'bacteria',
        'odor',
        'taste',
        'color'
      ]
    }],
    
    flowRate: Number, // производительность системы (л/ч)
    residents: Number, // количество жильцов
    installationDate: Date,
    
    // Стоимость проекта
    projectCost: {
      equipment: Number,
      installation: Number,
      materials: Number,
      total: Number
    },
    
    installationTime: Number, // время монтажа (часы)
  },
  
  // ============================================
  // РЕЗУЛЬТАТЫ
  // ============================================
  waterQuality: {
    before: {
      iron: Number,
      manganese: Number,
      hardness: Number,
      ph: Number
    },
    after: {
      iron: Number,
      manganese: Number,
      hardness: Number,
      ph: Number
    },
    improvement: String // "Железо снижено на 95%"
  },
  
  clientFeedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    date: Date
  },
  
  // ============================================
  // ИСПОЛЬЗОВАНИЕ
  // ============================================
  isActive: {
    type: Boolean,
    default: true
  },
  
  isDefault: {
    type: Boolean,
    default: false // показывать по умолчанию в КП
  },
  
  // Приоритет отображения (чем выше, тем раньше показывается)
  priority: {
    type: Number,
    default: 0
  },
  
  // Счётчик использования
  usageCount: {
    type: Number,
    default: 0
  },
  
  // ============================================
  // ПУБЛИКАЦИЯ
  // ============================================
  isPublic: {
    type: Boolean,
    default: true
  },
  
  showInPortfolio: {
    type: Boolean,
    default: false
  },
  
  // Анонимность (скрывать адрес/имена)
  anonymized: {
    type: Boolean,
    default: true
  },
  
  // ============================================
  // ТЕГИ И ПОИСК
  // ============================================
  tags: [String],
  
  keywords: [String], // для поиска
  
  // ============================================
  // СВЯЗИ
  // ============================================
  proposalId: {
    type: Schema.Types.ObjectId,
    ref: 'Proposal'
  },
  
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  managerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  technicianId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ============================================
  // ФАЙЛЫ И МЕДИА
  // ============================================
  additionalPhotos: [String], // дополнительные фото
  
  videoUrl: String, // ссылка на видео
  
  documents: [{
    type: {
      type: String,
      enum: ['analysis', 'certificate', 'warranty', 'act']
    },
    url: String,
    name: String
  }],
  
  // ============================================
  // СОЗДАНИЕ И ПРОВЕРКА
  // ============================================
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  // ============================================
  // КАЧЕСТВО ФОТО
  // ============================================
  quality: {
    type: String,
    enum: ['excellent', 'good', 'acceptable', 'poor'],
    default: 'good'
  },
  
  // Оценка (внутренняя)
  internalRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  // ============================================
  // ПРИМЕЧАНИЯ
  // ============================================
  notes: String,
  internalNotes: String, // внутренние заметки
  
  // ============================================
  // ОСОБЕННОСТИ
  // ============================================
  features: [{
    type: String,
    enum: [
      'compact_installation',  // Компактная установка
      'hidden_installation',   // Скрытая установка
      'aesthetic_design',      // Эстетичное оформление
      'difficult_access',      // Сложный доступ
      'non_standard_solution', // Нестандартное решение
      'premium_equipment',     // Премиум оборудование
      'budget_solution'        // Бюджетное решение
    ]
  }],
  
  // Уникальные решения
  uniqueSolutions: [String],
  
  // Сложность проекта
  complexity: {
    type: String,
    enum: ['simple', 'medium', 'complex', 'very_complex'],
    default: 'medium'
  }
  
}, {
  timestamps: true
});

// ============================================
// ВИРТУАЛЬНЫЕ ПОЛЯ
// ============================================

WorkPhotoLibrarySchema.virtual('isPopular').get(function() {
  return this.usageCount > 5;
});

WorkPhotoLibrarySchema.virtual('hasClientFeedback').get(function() {
  return this.clientFeedback && this.clientFeedback.rating;
});

WorkPhotoLibrarySchema.virtual('improvementText').get(function() {
  if (!this.waterQuality || !this.waterQuality.before || !this.waterQuality.after) {
    return null;
  }
  
  const improvements = [];
  const { before, after } = this.waterQuality;
  
  if (before.iron && after.iron) {
    const reduction = ((before.iron - after.iron) / before.iron * 100).toFixed(0);
    improvements.push(`Железо снижено на ${reduction}%`);
  }
  
  if (before.hardness && after.hardness) {
    const reduction = ((before.hardness - after.hardness) / before.hardness * 100).toFixed(0);
    improvements.push(`Жёсткость снижена на ${reduction}%`);
  }
  
  return improvements.join(', ');
});

// ============================================
// ИНДЕКСЫ
// ============================================

WorkPhotoLibrarySchema.index({ category: 1 });
WorkPhotoLibrarySchema.index({ systemType: 1 });
WorkPhotoLibrarySchema.index({ isActive: 1 });
WorkPhotoLibrarySchema.index({ isDefault: 1 });
WorkPhotoLibrarySchema.index({ priority: -1 });
WorkPhotoLibrarySchema.index({ usageCount: -1 });
WorkPhotoLibrarySchema.index({ 'location.region': 1 });
WorkPhotoLibrarySchema.index({ 'location.city': 1 });
WorkPhotoLibrarySchema.index({ 'location.objectType': 1 });
WorkPhotoLibrarySchema.index({ tags: 1 });
WorkPhotoLibrarySchema.index({ showInPortfolio: 1 });
WorkPhotoLibrarySchema.index({ uploadedAt: -1 });

// ============================================
// СТАТИЧЕСКИЕ МЕТОДЫ
// ============================================

// Получить фото по умолчанию для КП
WorkPhotoLibrarySchema.statics.getDefaultPhotos = async function(count = 3) {
  return this.find({
    isActive: true,
    isDefault: true
  })
  .sort({ priority: -1, usageCount: -1 })
  .limit(count)
  .lean();
};

// Поиск похожих проектов
WorkPhotoLibrarySchema.statics.findSimilar = async function(filters, limit = 10) {
  const query = { isActive: true };
  
  if (filters.objectType) {
    query['location.objectType'] = filters.objectType;
  }
  
  if (filters.region) {
    query['location.region'] = filters.region;
  }
  
  if (filters.systemType) {
    query.systemType = filters.systemType;
  }
  
  if (filters.waterSource) {
    query['projectDetails.waterSource'] = filters.waterSource;
  }
  
  return this.find(query)
    .sort({ priority: -1, usageCount: -1, uploadedAt: -1 })
    .limit(limit)
    .lean();
};

// Получить портфолио
WorkPhotoLibrarySchema.statics.getPortfolio = async function(filters = {}) {
  const query = {
    isActive: true,
    showInPortfolio: true,
    isPublic: true
  };
  
  if (filters.category) query.category = filters.category;
  if (filters.systemType) query.systemType = filters.systemType;
  if (filters.region) query['location.region'] = filters.region;
  
  return this.find(query)
    .sort({ priority: -1, internalRating: -1, uploadedAt: -1 })
    .populate('uploadedBy', 'name')
    .lean();
};

// Поиск по тегам
WorkPhotoLibrarySchema.statics.searchByTags = async function(tags, limit = 20) {
  return this.find({
    isActive: true,
    tags: { $in: tags }
  })
  .sort({ priority: -1, usageCount: -1 })
  .limit(limit)
  .lean();
};

// Статистика по региону
WorkPhotoLibrarySchema.statics.getRegionStats = async function() {
  return this.aggregate([
    { $match: { isActive: true, isPublic: true } },
    {
      $group: {
        _id: '$location.region',
        count: { $sum: 1 },
        avgRating: { $avg: '$clientFeedback.rating' },
        systemTypes: { $push: '$systemType' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// ============================================
// МЕТОДЫ ЭКЗЕМПЛЯРА
// ============================================

// Увеличить счётчик использования
WorkPhotoLibrarySchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  return this.save();
};

// Установить как фото по умолчанию
WorkPhotoLibrarySchema.methods.setAsDefault = async function() {
  this.isDefault = true;
  this.priority = 100;
  return this.save();
};

// Снять статус по умолчанию
WorkPhotoLibrarySchema.methods.removeFromDefault = async function() {
  this.isDefault = false;
  return this.save();
};

// ============================================
// MIDDLEWARE
// ============================================

// Установка миниатюры при сохранении
WorkPhotoLibrarySchema.pre('save', function(next) {
  if (this.isModified('image') && !this.thumbnail) {
    this.thumbnail = this.image;
  }
  next();
});

// Генерация тегов из других полей
WorkPhotoLibrarySchema.pre('save', function(next) {
  if (!this.tags || this.tags.length === 0) {
    const autoTags = [];
    
    if (this.location && this.location.region) {
      autoTags.push(this.location.region.toLowerCase());
    }
    
    if (this.systemType) {
      autoTags.push(this.systemType);
    }
    
    if (this.category) {
      autoTags.push(this.category);
    }
    
    this.tags = [...new Set(autoTags)]; // убрать дубли
  }
  next();
});

// ============================================
// ЭКСПОРТ
// ============================================

module.exports = mongoose.model('WorkPhotoLibrary', WorkPhotoLibrarySchema);
