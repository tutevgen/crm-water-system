/**
 * База данных анализов воды - для статистики и рекомендаций
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WaterAnalysisDatabaseSchema = new Schema({
  // Регион
  region: {
    type: String,
    required: true,
    index: true
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  address: String,
  
  // Координаты для карты
  coordinates: {
    lat: Number,
    lng: Number
  },
  
  // Источник воды
  waterSource: {
    type: String,
    enum: ['well', 'borehole', 'central', 'river'],
    required: true
  },
  
  // Данные анализа
  analysisData: {
    iron: Number,          // Железо (мг/л)
    manganese: Number,     // Марганец (мг/л)
    hardness: Number,      // Жёсткость (°Ж)
    ph: Number,            // pH
    hydrogen_sulfide: Number, // Сероводород (мг/л)
    oxidability: Number,   // Окисляемость (мгО2/л)
    turbidity: Number,     // Мутность (ЕМФ)
    tds: Number,          // Солесодержание (мг/л)
    chlorides: Number,     // Хлориды (мг/л)
    sulfates: Number,      // Сульфаты (мг/л)
    nitrates: Number,      // Нитраты (мг/л)
    ammonium: Number,      // Аммоний (мг/л)
    color: Number,         // Цветность (градусы)
    smell: String          // Запах (описание)
  },
  
  // Оценка качества
  qualityRating: {
    type: String,
    enum: ['excellent', 'good', 'acceptable', 'poor', 'dangerous'],
    default: 'acceptable'
  },
  
  // Выявленные проблемы
  problems: [{
    type: String,
    enum: [
      'high_iron',
      'high_manganese', 
      'high_hardness',
      'low_ph',
      'high_ph',
      'hydrogen_sulfide',
      'high_turbidity',
      'high_tds',
      'bacteria',
      'organic_pollution'
    ]
  }],
  
  // Установленное оборудование
  installedEquipment: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    category: String,
    price: Number
  }],
  
  // Результат после установки
  afterInstallation: {
    iron: Number,
    manganese: Number,
    hardness: Number,
    ph: Number,
    improvementPercent: Number, // Процент улучшения
    clientSatisfaction: Number  // Оценка клиента 1-5
  },
  
  // Ссылки
  proposalId: {
    type: Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Даты
  analysisDate: {
    type: Date,
    default: Date.now
  },
  installationDate: Date,
  
  // Метаданные
  isVerified: { type: Boolean, default: false }, // Проверено менеджером
  isPublic: { type: Boolean, default: false },   // Показывать в статистике
  notes: String
  
}, {
  timestamps: true
});

// Автоматическая оценка качества воды
WaterAnalysisDatabaseSchema.pre('save', function(next) {
  const analysis = this.analysisData;
  const problems = [];
  let issueCount = 0;
  
  // Проверка железа (норма до 0.3 мг/л)
  if (analysis.iron > 0.3) {
    problems.push('high_iron');
    if (analysis.iron > 1.0) issueCount += 2;
    else issueCount += 1;
  }
  
  // Проверка марганца (норма до 0.1 мг/л)
  if (analysis.manganese > 0.1) {
    problems.push('high_manganese');
    if (analysis.manganese > 0.5) issueCount += 2;
    else issueCount += 1;
  }
  
  // Проверка жёсткости (норма до 7 °Ж)
  if (analysis.hardness > 7) {
    problems.push('high_hardness');
    if (analysis.hardness > 14) issueCount += 2;
    else issueCount += 1;
  }
  
  // Проверка pH (норма 6.5-8.5)
  if (analysis.ph < 6.5) {
    problems.push('low_ph');
    issueCount += 1;
  } else if (analysis.ph > 8.5) {
    problems.push('high_ph');
    issueCount += 1;
  }
  
  // Проверка сероводорода
  if (analysis.hydrogen_sulfide > 0.03) {
    problems.push('hydrogen_sulfide');
    issueCount += 2;
  }
  
  // Проверка мутности (норма до 1.5 ЕМФ)
  if (analysis.turbidity > 1.5) {
    problems.push('high_turbidity');
    issueCount += 1;
  }
  
  // Проверка солесодержания (норма до 1000 мг/л)
  if (analysis.tds > 1000) {
    problems.push('high_tds');
    issueCount += 1;
  }
  
  this.problems = problems;
  
  // Оценка качества
  if (issueCount === 0) this.qualityRating = 'excellent';
  else if (issueCount <= 2) this.qualityRating = 'good';
  else if (issueCount <= 4) this.qualityRating = 'acceptable';
  else if (issueCount <= 6) this.qualityRating = 'poor';
  else this.qualityRating = 'dangerous';
  
  next();
});

// Метод для получения рекомендаций оборудования
WaterAnalysisDatabaseSchema.methods.getEquipmentRecommendations = async function() {
  const recommendations = [];
  const Product = mongoose.model('Product');
  
  // Рекомендации на основе проблем
  if (this.problems.includes('high_iron')) {
    const ironFilters = await Product.find({ 
      category: 'iron_removal',
      isActive: true 
    }).limit(3);
    recommendations.push(...ironFilters.map(p => ({
      reason: 'Обезжелезивание',
      product: p
    })));
  }
  
  if (this.problems.includes('high_hardness')) {
    const softeningFilters = await Product.find({ 
      category: 'softening',
      isActive: true 
    }).limit(3);
    recommendations.push(...softeningFilters.map(p => ({
      reason: 'Умягчение воды',
      product: p
    })));
  }
  
  if (this.problems.includes('hydrogen_sulfide')) {
    const aerationSystems = await Product.find({ 
      category: 'aeration',
      isActive: true 
    }).limit(2);
    recommendations.push(...aerationSystems.map(p => ({
      reason: 'Удаление сероводорода',
      product: p
    })));
  }
  
  return recommendations;
};

// Статические методы для аналитики
WaterAnalysisDatabaseSchema.statics.getRegionStatistics = async function(region) {
  return this.aggregate([
    { $match: { region: region, isPublic: true } },
    {
      $group: {
        _id: '$city',
        avgIron: { $avg: '$analysisData.iron' },
        avgManganese: { $avg: '$analysisData.manganese' },
        avgHardness: { $avg: '$analysisData.hardness' },
        avgPh: { $avg: '$analysisData.ph' },
        count: { $sum: 1 },
        commonProblems: { $push: '$problems' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

WaterAnalysisDatabaseSchema.statics.findSimilar = async function(analysisData, limit = 5) {
  // Поиск похожих случаев в радиусе ±20% от значений
  const ironRange = analysisData.iron * 0.2;
  const manganesRange = analysisData.manganese * 0.2;
  const hardnessRange = analysisData.hardness * 0.2;
  
  return this.find({
    isPublic: true,
    'analysisData.iron': { 
      $gte: analysisData.iron - ironRange,
      $lte: analysisData.iron + ironRange
    },
    'analysisData.manganese': { 
      $gte: analysisData.manganese - manganesRange,
      $lte: analysisData.manganese + manganesRange
    },
    'analysisData.hardness': { 
      $gte: analysisData.hardness - hardnessRange,
      $lte: analysisData.hardness + hardnessRange
    }
  })
  .populate('installedEquipment.productId')
  .limit(limit)
  .sort({ 'afterInstallation.clientSatisfaction': -1 });
};

// Индексы
WaterAnalysisDatabaseSchema.index({ region: 1, city: 1 });
WaterAnalysisDatabaseSchema.index({ qualityRating: 1 });
WaterAnalysisDatabaseSchema.index({ problems: 1 });
WaterAnalysisDatabaseSchema.index({ analysisDate: -1 });
WaterAnalysisDatabaseSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('WaterAnalysisDB', WaterAnalysisDatabaseSchema);
