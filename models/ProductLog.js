const mongoose = require('mongoose');

const productLogSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'visibility', 'restore'],
    index: true
  },
  changes: {
    type: [String],
    default: []
  },
  oldValues: {
    type: mongoose.Schema.Types.Mixed
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  }
});

// Индексы
productLogSchema.index({ product: 1, timestamp: -1 });
productLogSchema.index({ user: 1, timestamp: -1 });
productLogSchema.index({ timestamp: -1 });

// Автоматическое удаление старых логов (старше 90 дней)
productLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Статический метод для получения логов товара
productLogSchema.statics.getByProduct = async function(productId, limit) {
  limit = limit || 50;
  
  return await this.find({ product: productId })
    .populate('user', 'name email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Статический метод для получения последних логов
productLogSchema.statics.getRecent = async function(limit) {
  limit = limit || 20;
  
  return await this.find()
    .populate('user', 'name email')
    .populate('product', 'name sku')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Статический метод для получения статистики действий
productLogSchema.statics.getStats = async function(days) {
  days = days || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('ProductLog', productLogSchema);
