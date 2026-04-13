const { escapeRegex } = require("../utils/helpers");
const Category = require('../models/Category');
const Product = require('../models/admin/Product');

/**
 * Получить все категории (API)
 */
exports.index = async (req, res, next) => {
  try {
    const categories = await Category.find()
      .sort({ name: 1 })
      .lean();
    
    // Добавляем количество товаров
    for (let cat of categories) {
      cat.productCount = await Product.countDocuments({ 
        category: cat._id, 
        deletedAt: null 
      });
    }
    
    res.json({ success: true, categories });
    
  } catch (err) {
    console.error('Ошибка получения категорий:', err);
    res.status(500).json({ success: false, message: 'Ошибка получения категорий' });
  }
};

/**
 * Создать категорию
 */
exports.create = async (req, res, next) => {
  try {
    const { name, parent } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Название обязательно' });
    }
    
    // Проверяем уникальность
    const existing = await Category.findOne({ 
      name: new RegExp('^' + escapeRegex(name.trim()) + '$', 'i') 
    });
    
    if (existing) {
      return res.status(400).json({ success: false, message: 'Категория с таким названием уже существует' });
    }
    
    // Генерируем slug
    const slug = name.trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    
    const category = new Category({
      name: name.trim(),
      slug: slug,
      parent: parent || null
    });
    
    await category.save();
    
    res.json({ success: true, category, message: 'Категория создана' });
    
  } catch (err) {
    console.error('Ошибка создания категории:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Категория с таким названием уже существует' });
    }
    
    res.status(500).json({ success: false, message: 'Ошибка создания категории' });
  }
};

/**
 * Обновить категорию
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, parent } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Название обязательно' });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Категория не найдена' });
    }
    
    // Проверяем уникальность
    const existing = await Category.findOne({ 
      name: new RegExp('^' + escapeRegex(name.trim()) + '$', 'i'),
      _id: { $ne: id }
    });
    
    if (existing) {
      return res.status(400).json({ success: false, message: 'Категория с таким названием уже существует' });
    }
    
    // Нельзя сделать категорию родителем самой себя
    if (parent && parent === id) {
      return res.status(400).json({ success: false, message: 'Категория не может быть родителем самой себя' });
    }
    
    category.name = name.trim();
    category.slug = name.trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    category.parent = parent || null;
    
    await category.save();
    
    res.json({ success: true, category, message: 'Категория обновлена' });
    
  } catch (err) {
    console.error('Ошибка обновления категории:', err);
    res.status(500).json({ success: false, message: 'Ошибка обновления категории' });
  }
};

/**
 * Удалить категорию
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Категория не найдена' });
    }
    
    // Проверяем есть ли дочерние категории
    const childrenCount = await Category.countDocuments({ parent: id });
    if (childrenCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Сначала удалите дочерние категории (' + childrenCount + ' шт.)' 
      });
    }
    
    // Обнуляем категорию у товаров
    await Product.updateMany(
      { category: id },
      { $unset: { category: '' } }
    );
    
    await Category.deleteOne({ _id: id });
    
    res.json({ success: true, message: 'Категория удалена' });
    
  } catch (err) {
    console.error('Ошибка удаления категории:', err);
    res.status(500).json({ success: false, message: 'Ошибка удаления категории' });
  }
};

/**
 * Получить категорию по ID
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id).lean();
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Категория не найдена' });
    }
    
    // Количество товаров
    category.productCount = await Product.countDocuments({ 
      category: id, 
      deletedAt: null 
    });
    
    res.json({ success: true, category });
    
  } catch (err) {
    console.error('Ошибка получения категории:', err);
    res.status(500).json({ success: false, message: 'Ошибка получения категории' });
  }
};
