const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Схема документа товара
 */
const ProductDocumentSchema = new Schema({
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['manual', 'certificate', 'passport', 'scheme', 'warranty', 'other'],
    default: 'other'
  },
  file: { type: String, required: true }, // путь к файлу
  size: Number, // размер в байтах
  uploadedAt: { type: Date, default: Date.now }
});

/**
 * Схема изображения галереи
 */
const GalleryImageSchema = new Schema({
  url: { type: String, required: true },
  alt: String,
  order: { type: Number, default: 0 },
  isMain: { type: Boolean, default: false }
});

/**
 * Основная схема товара
 */
const ProductSchema = new Schema({
  // Основные поля
  name: {
    type: String,
    required: [true, 'Название товара обязательно'],
    trim: true,
    maxlength: [200, 'Название не может быть длиннее 200 символов']
  },
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  
  // Категория
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Категория обязательна']
  },

  // Категория для раздела оборудования в КП
 proposalCategory: {
  type: String,
  enum: ['', 'Аэрация', 'Обезжелезивание', 'Умягчение', 'Механическая очистка',
         'Обратный осмос', 'УФ-обеззараживание', 'Сорбция', 'Дозирование', 'Дополнительное оборудование'],
  default: ''
},
  
  // Цены
  price: {
    type: Number,
    required: [true, 'Цена обязательна'],
    min: [0, 'Цена не может быть отрицательной']
  },
  wholesalePrice: {
    type: Number,
    min: [0, 'Оптовая цена не может быть отрицательной']
  },
  oldPrice: {
    type: Number,
    min: [0, 'Старая цена не может быть отрицательной']
  },
  
  // Склад
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  warehouse: String,
  unit: {
    type: String,
    default: 'шт',
    enum: ['шт', 'кг', 'л', 'м', 'м²', 'м³', 'комплект', 'упаковка', 'рулон']
  },
  
  // Описание
  shortDescription: {
    type: String,
    maxlength: [500, 'Краткое описание не может быть длиннее 500 символов']
  },
  description: {
    type: String,
    maxlength: [10000, 'Описание не может быть длиннее 10000 символов']
  },
  
  // Изображения
  photo: String, // основное фото (для обратной совместимости)
  gallery: [GalleryImageSchema],
  
  // Документы
  documents: [ProductDocumentSchema],
  
  // Характеристики
  characteristics: {
    type: Map,
    of: String
  },
  
  // Дополнительная информация
  brand: String,
  manufacturer: String,
  countryOfOrigin: String,
  warranty: Number, // в месяцах
  weight: Number, // в кг
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  
  // Медиа
  videoUrl: String, // YouTube или другое видео
  
  // SEO
  seo: {
    title: { type: String, maxlength: 70 },
    description: { type: String, maxlength: 160 },
    keywords: { type: String, maxlength: 255 }
  },
  
  // Флаги
  isVisible: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNewProduct: {
    type: Boolean,
    default: false
  },
  
  // Метаданные
  metadata: {
    views: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0 }
  },
  
  // Связи
  relatedProducts: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Аудит
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Индексы
ProductSchema.index({ name: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ isVisible: 1, isActive: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ 'metadata.sales': -1 });
// FIX #26: text-индекс для поиска в каталоге
ProductSchema.index(
  { name: 'text', sku: 'text', shortDescription: 'text', brand: 'text' },
  { weights: { name: 10, sku: 5, shortDescription: 3, brand: 2 }, name: 'product_text_search' }
);

/**
 * Транслитерация для slug
 */
function transliterate(text) {
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    ' ': '-', '_': '-'
  };
  
  return text.toLowerCase().split('').map(function(char) {
    return map[char] || char;
  }).join('').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Генерация уникального slug
 */
ProductSchema.methods.generateUniqueSlug = async function() {
  var baseSlug = transliterate(this.name);
  var slug = baseSlug;
  var counter = 1;
  var maxAttempts = 100;
  
  while (counter < maxAttempts) {
    var existing = await this.constructor.findOne({ slug: slug, _id: { $ne: this._id } });
    if (!existing) {
      return slug;
    }
    slug = baseSlug + '-' + counter;
    counter++;
  }
  
  return baseSlug + '-' + Date.now();
};

/**
 * Генерация уникального SKU
 */
ProductSchema.methods.generateUniqueSku = async function() {
  var prefix = 'PRD';
  var sku;
  var counter = 0;
  var maxAttempts = 100;
  
  while (counter < maxAttempts) {
    var random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    sku = prefix + '-' + random;
    
    var existing = await this.constructor.findOne({ sku: sku, _id: { $ne: this._id } });
    if (!existing) {
      return sku;
    }
    counter++;
  }
  
  return prefix + '-' + Date.now();
};

/**
 * Pre-save хук
 */
ProductSchema.pre('save', async function(next) {
  // Генерируем slug если нет
  if (!this.slug) {
    this.slug = await this.generateUniqueSlug();
  }
  
  // Генерируем SKU если нет
  if (!this.sku) {
    this.sku = await this.generateUniqueSku();
  }
  
  // Синхронизируем главное фото с галереей
  if (this.gallery && this.gallery.length > 0) {
    var mainImage = this.gallery.find(function(img) { return img.isMain; });
    if (mainImage) {
      this.photo = mainImage.url;
    } else if (!this.photo) {
      this.photo = this.gallery[0].url;
      this.gallery[0].isMain = true;
    }
  }
  
  next();
});

/**
 * Мягкое удаление
 */
ProductSchema.methods.softDelete = function(userId) {
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  this.isVisible = false;
  return this.save();
};

/**
 * Восстановление
 */
ProductSchema.methods.restore = function() {
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.isActive = true;
  return this.save();
};

/**
 * Добавить изображение в галерею
 */
ProductSchema.methods.addGalleryImage = function(imageData) {
  if (!this.gallery) {
    this.gallery = [];
  }
  
  // Если это первое изображение или указано как главное
  if (this.gallery.length === 0 || imageData.isMain) {
    // Сбрасываем isMain у других
    this.gallery.forEach(function(img) { img.isMain = false; });
    imageData.isMain = true;
  }
  
  imageData.order = this.gallery.length;
  this.gallery.push(imageData);
  
  return this.save();
};

/**
 * Удалить изображение из галереи
 */
ProductSchema.methods.removeGalleryImage = function(imageId) {
  var index = this.gallery.findIndex(function(img) { 
    return img._id.toString() === imageId.toString(); 
  });
  
  if (index > -1) {
    var wasMain = this.gallery[index].isMain;
    this.gallery.splice(index, 1);
    
    // Если удалили главное, назначаем новое
    if (wasMain && this.gallery.length > 0) {
      this.gallery[0].isMain = true;
      this.photo = this.gallery[0].url;
    } else if (this.gallery.length === 0) {
      this.photo = null;
    }
  }
  
  return this.save();
};

/**
 * Добавить документ
 */
ProductSchema.methods.addDocument = function(docData) {
  if (!this.documents) {
    this.documents = [];
  }
  this.documents.push(docData);
  return this.save();
};

/**
 * Удалить документ
 */
ProductSchema.methods.removeDocument = function(docId) {
  if (this.documents) {
    this.documents = this.documents.filter(function(doc) { 
      return doc._id.toString() !== docId.toString(); 
    });
  }
  return this.save();
};

/**
 * Статические методы
 */

// Поиск товаров
ProductSchema.statics.search = function(query, options) {
  options = options || {};
  var filter = { deletedAt: null, isActive: true };
  
  if (query) {
    filter.$or = [
      { name: new RegExp(query, 'i') },
      { sku: new RegExp(query, 'i') },
      { description: new RegExp(query, 'i') },
      { brand: new RegExp(query, 'i') }
    ];
  }
  
  return this.find(filter)
    .populate('category', 'name slug')
    .sort(options.sort || { createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20);
};

// Похожие товары
ProductSchema.statics.getSimilar = function(productId, limit) {
  limit = limit || 4;
  var self = this;
  
  return this.findById(productId).then(function(product) {
    if (!product) return [];
    
    return self.find({
      _id: { $ne: productId },
      category: product.category,
      isVisible: true,
      isActive: true,
      deletedAt: null
    })
    .limit(limit)
    .lean();
  });
};

// Популярные товары
ProductSchema.statics.getPopular = function(limit) {
  limit = limit || 10;
  return this.find({ 
    isVisible: true, 
    isActive: true, 
    deletedAt: null 
  })
  .sort({ 'metadata.sales': -1 })
  .limit(limit)
  .populate('category', 'name slug')
  .lean();
};

// Новинки
ProductSchema.statics.getNew = function(limit) {
  limit = limit || 10;
  return this.find({ 
    isVisible: true, 
    isActive: true, 
    deletedAt: null,
    isNewProduct: true 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('category', 'name slug')
  .lean();
};

// Товары со скидкой
ProductSchema.statics.getDiscounted = function(limit) {
  limit = limit || 10;
  return this.find({ 
    isVisible: true, 
    isActive: true, 
    deletedAt: null,
    oldPrice: { $gt: 0 },
    $expr: { $lt: ['$price', '$oldPrice'] }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('category', 'name slug')
  .lean();
};

// FIX #28: агрегат вместо загрузки всех документов в память
ProductSchema.statics.getCharacteristicsValues = async function() {
  var result = await this.aggregate([
    { $match: { deletedAt: null } },
    { $project: { chars: { $objectToArray: '$characteristics' } } },
    { $unwind: '$chars' },
    { $group: { _id: '$chars.k', values: { $addToSet: '$chars.v' } } },
    { $sort: { _id: 1 } }
  ]);
  return Object.fromEntries(
    result.map(function(r) {
      return [r._id, r.values.filter(Boolean).sort()];
    })
  );
};

// Получить все бренды
ProductSchema.statics.getBrands = function() {
  return this.distinct('brand', { deletedAt: null, brand: { $ne: null } });
};

// Обновить счётчик просмотров
ProductSchema.statics.incrementViews = function(productId) {
  return this.updateOne(
    { _id: productId },
    { $inc: { 'metadata.views': 1 } }
  );
};

// Обновить счётчик продаж
ProductSchema.statics.incrementSales = function(productId, qty) {
  qty = qty || 1;
  return this.updateOne(
    { _id: productId },
    { $inc: { 'metadata.sales': qty } }
  );
};

module.exports = mongoose.model('Product', ProductSchema);