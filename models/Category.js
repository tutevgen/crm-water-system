const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Название категории обязательно'],
    trim: true,
    unique: true,
    minlength: [2, 'Название должно содержать минимум 2 символа'],
    maxlength: [100, 'Название не должно превышать 100 символов']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Описание не должно превышать 500 символов']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  image: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  productCount: {
    type: Number,
    default: 0
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ name: 'text' });
categorySchema.index({ order: 1, name: 1 });

// Виртуальное поле для дочерних категорий
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Pre-save хук для генерации slug
categorySchema.pre('save', async function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = await this.generateUniqueSlug(this.name);
  }
  next();
});

// Функция транслитерации
function transliterate(str) {
  const ru = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  return str.toLowerCase().split('').map(function(char) {
    return ru[char] || char;
  }).join('');
}

// Метод для генерации уникального slug
categorySchema.methods.generateUniqueSlug = async function(name) {
  var slug = transliterate(name)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
  
  if (!slug) {
    slug = 'category';
  }
  
  var uniqueSlug = slug;
  var counter = 1;
  var Model = this.constructor;
  
  while (true) {
    var existing = await Model.findOne({ 
      slug: uniqueSlug, 
      _id: { $ne: this._id } 
    });
    
    if (!existing) break;
    
    uniqueSlug = slug + '-' + counter;
    counter++;
    
    if (counter > 100) {
      uniqueSlug = slug + '-' + Date.now();
      break;
    }
  }
  
  return uniqueSlug;
};

// Метод для обновления счетчика товаров
categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  this.productCount = await Product.countDocuments({ 
    category: this._id,
    deletedAt: null,
    isActive: true
  });
  await this.save();
};

// Статический метод для получения дерева категорий
categorySchema.statics.getTree = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();
  
  // Строим дерево
  const map = {};
  const roots = [];
  
  categories.forEach(function(cat) {
    map[cat._id.toString()] = cat;
    cat.children = [];
  });
  
  categories.forEach(function(cat) {
    if (cat.parent) {
      const parent = map[cat.parent.toString()];
      if (parent) {
        parent.children.push(cat);
      } else {
        roots.push(cat);
      }
    } else {
      roots.push(cat);
    }
  });
  
  return roots;
};

// Статический метод для получения корневых категорий
categorySchema.statics.getRootCategories = async function() {
  return await this.find({ parent: null, isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();
};

// Статический метод для получения категорий с подкатегориями
categorySchema.statics.getWithChildren = async function() {
  return await this.find({ isActive: true })
    .populate({
      path: 'children',
      match: { isActive: true },
      options: { sort: { order: 1, name: 1 } }
    })
    .sort({ order: 1, name: 1 })
    .lean();
};

module.exports = mongoose.model('Category', categorySchema);
