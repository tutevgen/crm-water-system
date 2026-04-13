/**
 * Модель коммерческого предложения - РАСШИРЕННАЯ ВЕРСИЯ
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CounterSchema = new Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

const ProposalSchema = new Schema({
  proposalNumber: { type: String, unique: true },
  
  // ТИП КП
  proposalType: {
    type: String,
    enum: ['installation', 'refill', 'maintenance', 'repair'],
    default: 'installation'
  },
  
  // КЛИЕНТ
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientName: String,
  clientEmail: String,
  clientPhone: String,
  
  // МЕНЕДЖЕР
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  managerName: String,
  managerPhone: String,
  managerEmail: String,
  
  // ОБЪЕКТ
  objectAddress: String,
  objectType: {
    type: String,
    enum: ['house', 'dacha', 'apartment', 'commercial', 'production'],
    default: 'house'
  },
  waterSource: {
    type: String,
    enum: ['well', 'borehole', 'central', 'river'],
    default: 'well'
  },
  residents: { type: Number, default: 4 },
  waterPoints: { type: Number, default: 8 },
  
  // АНАЛИЗ ВОДЫ (расширенный)
  waterAnalysis: {
    iron: Number,
    manganese: Number,
    hardness: Number,
    ph: Number,
    hydrogen_sulfide: Number,
    turbidity: Number,
    color: Number,
    tds: Number,
    oxidability: Number,
    ammonia: Number,
    nitrates: Number,
    bacteria: Number,
    file: String
  },
  
  // ПРОБЛЕМЫ (автоматически определяются по анализу)
  waterProblems: [{
    code: String,           // iron_high, hardness_high, etc.
    title: String,          // "Повышенное железо"
    description: String,    // "Вода оставляет рыжие пятна..."
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    icon: String            // emoji или класс иконки
  }],
  
  // СХЕМА И ФОТО
  schemaImage: String,
  workPhotos: [String],
  
  // ВАРИАНТЫ КОМПЛЕКТАЦИИ (для сравнения)
  variants: [{
    name: String,           // "Эконом", "Оптимальный", "Премиум"
    isRecommended: Boolean,
    items: [{
      productId: { type: Schema.Types.ObjectId, ref: 'Product' },
      sku: String,
      name: String,
      description: String,
      image: String,
      quantity: { type: Number, default: 1 },
      unit: { type: String, default: 'шт' },
      price: Number
    }],
    equipmentTotal: Number,
    servicesTotal: Number,
    totalPrice: Number
  }],
  
  // ВЫБРАННЫЙ ВАРИАНТ (или единственный)
  selectedVariant: { type: Number, default: 0 },
  
  // ОБОРУДОВАНИЕ (основной список)
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    sku: String,
    name: { type: String, required: true },
    description: String,
    image: String,
    category: { type: String, default: '' }, // Аэрация, Обезжелезивание, Умягчение...
    features: [String],
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'шт' },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 }
  }],

  // ПРЕМИУМ ВАРИАНТ
  premiumItems: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    sku: String,
    name: String,
    description: String,
    image: String,
    category: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'шт' },
    price: { type: Number, required: true }
  }],
  premiumPipingMaterial: String,
  premiumPipingMaterialName: String,
  premiumPipingPrice: { type: Number, default: 0 },
  premiumServicesTotal: { type: Number, default: 0 },
  premiumEquipmentTotal: { type: Number, default: 0 },
  premiumTotal: { type: Number, default: 0 },
  premiumNotes: String,
  
  // РЕКОМЕНДУЕМЫЕ ОПЦИИ (с описанием пользы)
  recommendedOptions: [{
    code: String,
    name: String,
    description: String,    // Почему это нужно
    benefit: String,        // Ключевая выгода
    price: Number,
    image: String
  }],
  
  // МАТЕРИАЛ ОБВЯЗКИ
  pipingMaterial: {
    type: String,
    // FIX #14: значения совпадают с шаблоном _step3-equipment.ejs и PIPING_MATERIALS в контроллере
    enum: ['polypropylene', 'metal_plastic', 'stainless', 'copper'],
    default: 'polypropylene'
  },
  pipingMaterialName: String,
  pipingMaterialDesc: String,
  pipingMaterialPrice: { type: Number, default: 0 },
  
  // УСЛУГИ
  services: {
    delivery: { type: Boolean, default: false },
    deliveryPrice: { type: Number, default: 0 },
    installation: { type: Boolean, default: false },
    installationPrice: { type: Number, default: 0 },
    chiefInstallation: { type: Boolean, default: false },
    chiefInstallationPrice: { type: Number, default: 0 },
    commissioning: { type: Boolean, default: false },
    commissioningPrice: { type: Number, default: 0 },
    materials: { type: Boolean, default: false },
    materialsPrice: { type: Number, default: 0 }
  },
  
  // СУММЫ
  equipmentTotal: { type: Number, default: 0 },
  servicesTotal: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  clientDiscount: { type: Number, default: 0 },
  clientDiscountAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  
  // ЭКОНОМИЯ (для калькулятора)
  savings: {
    bottledWaterPerYear: { type: Number, default: 0 },    // Экономия на бутилированной воде
    applianceRepairSaved: { type: Number, default: 0 },   // Экономия на ремонте техники
    cleaningProductsSaved: { type: Number, default: 0 },  // Экономия на моющих средствах
    paybackMonths: { type: Number, default: 0 }           // Срок окупаемости в месяцах
  },
  
  // УСЛОВИЯ
  paymentTerms: {
    type: String,
    enum: ['100_prepay', '50_50', '30_70', 'postpay', 'installment'],
    default: '50_50'
  },
  paymentTermsText: String,
  installmentMonths: Number,        // Срок рассрочки
  installmentMonthlyPayment: Number, // Ежемесячный платёж
  deliveryTime: String,
  deliveryTimeText: String,
  installationTime: String,
  installationTimeText: String,
  validUntil: Date,
  
  // БОНУС ЗА БЫСТРОЕ РЕШЕНИЕ
  fastDecisionBonus: {
    enabled: { type: Boolean, default: false },
    deadline: Date,
    bonusText: String,      // "Анализ воды в подарок"
    bonusValue: Number      // Стоимость бонуса
  },
  
  // ГАРАНТИИ
  warrantyEquipment: { type: Number, default: 24 },
  warrantyInstallation: { type: Number, default: 24 },
  warrantyWater: { type: Number, default: 12 },
  
  // ЧТО ВКЛЮЧЕНО
  includes: [String],
  
  // ОТЗЫВ/КЕЙС
  testimonial: {
    enabled: { type: Boolean, default: false },
    clientName: String,
    location: String,       // "п. Николино, похожий объект"
    text: String,
    rating: Number,
    photo: String
  },
  
  // ПРИМЕЧАНИЯ
  notes: String,
  
  // СТАТУС
  status: {
    type: String,
    enum: [
      'draft',            // Черновик
      'sent',             // Отправлено клиенту
      'viewed',           // Просмотрено клиентом
      'accepted',         // Принято (стандарт)
      'accepted_premium', // Принято (премиум вариант)
      'in_progress',      // В работе / на монтаже
      'installed',        // Смонтировано
      'rejected',         // Отклонено
      'expired'           // Истекло
    ],
    default: 'draft'
  },

  // Выбранный вариант клиентом
  acceptedVariant: {
    type: String,
    enum: ['standard', 'premium'],
    default: 'standard'
  },
  acceptedAmount: { type: Number, default: 0 }, // Итоговая сумма выбранного варианта

  // ИСТОРИЯ
  sentAt: Date,
  sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
  viewedAt: Date,
  viewCount: { type: Number, default: 0 },
  acceptedAt: Date,
  acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  installedAt: Date,
  installedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  installNotes: String,  // Примечания после монтажа
  rejectedAt: Date,
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectReason: String,
  clientComment: String,
  
  // КОМПАНИЯ (для шапки КП)
  company: {
    name: String,
    fullName: String,
    logo: String,
    phone: String,
    email: String,
    website: String,
    address: String,
    whatsapp: String,
    telegram: String
  }
  
}, { timestamps: true });

// Генерация номера КП
ProposalSchema.pre('save', async function(next) {
  if (this.isNew && !this.proposalNumber) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        'proposalNumber',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const year = new Date().getFullYear();
      this.proposalNumber = `КП-${year}-${String(counter.seq).padStart(4, '0')}`;
    } catch (err) {
      console.error('Ошибка генерации номера КП:', err);
    }
  }
  next();
});

// Автоопределение проблем воды
ProposalSchema.methods.detectWaterProblems = function() {
  const problems = [];
  const a = this.waterAnalysis || {};
  
  if (a.iron > 0.3) {
    problems.push({
      code: 'iron_high',
      title: 'Повышенное содержание железа',
      description: `Железо ${a.iron} мг/л при норме 0.3 мг/л. Вода оставляет рыжие пятна на сантехнике, бельё желтеет при стирке.`,
      severity: a.iron > 1 ? 'high' : 'medium',
      icon: '🟤'
    });
  }
  
  if (a.hardness > 7) {
    problems.push({
      code: 'hardness_high',
      title: 'Жёсткая вода',
      description: `Жёсткость ${a.hardness} °Ж при норме 7 °Ж. Накипь в чайнике и бойлере, сухая кожа после душа, повышенный расход моющих средств.`,
      severity: a.hardness > 10 ? 'high' : 'medium',
      icon: 'ite'
    });
  }
  
  if (a.manganese > 0.1) {
    problems.push({
      code: 'manganese_high',
      title: 'Превышение марганца',
      description: `Марганец ${a.manganese} мг/л при норме 0.1 мг/л. Чёрный налёт на сантехнике, неприятный привкус воды.`,
      severity: a.manganese > 0.5 ? 'high' : 'medium',
      icon: '⚫'
    });
  }
  
  if (a.hydrogen_sulfide > 0.003) {
    problems.push({
      code: 'h2s_high',
      title: 'Сероводород',
      description: `Сероводород ${a.hydrogen_sulfide} мг/л. Запах тухлых яиц, коррозия труб и оборудования.`,
      severity: 'high',
      icon: '💨'
    });
  }
  
  if (a.turbidity > 2.6) {
    problems.push({
      code: 'turbidity_high',
      title: 'Мутная вода',
      description: `Мутность ${a.turbidity} ЕМФ при норме 2.6. Механические примеси, песок, глина.`,
      severity: 'medium',
      icon: '🌫️'
    });
  }
  
  this.waterProblems = problems;
  return problems;
};

// Расчёт экономии
ProposalSchema.methods.calculateSavings = function() {
  const residents = this.residents || 4;
  
  // Бутилированная вода: 2л/чел/день * 365 * кол-во * цена (примерно 30 руб/л)
  const bottledWater = residents * 2 * 365 * 15;
  
  // Ремонт техники (бойлер, стиралка) - примерно раз в 3 года при жёсткой воде
  const applianceRepair = this.waterAnalysis?.hardness > 7 ? 15000 : 0;
  
  // Моющие средства - экономия ~30% при мягкой воде
  const cleaningProducts = this.waterAnalysis?.hardness > 7 ? 6000 : 0;
  
  const totalYearlySavings = bottledWater + applianceRepair + cleaningProducts;
  const paybackMonths = totalYearlySavings > 0 ? Math.ceil(this.totalPrice / (totalYearlySavings / 12)) : 0;
  
  this.savings = {
    bottledWaterPerYear: bottledWater,
    applianceRepairSaved: applianceRepair,
    cleaningProductsSaved: cleaningProducts,
    paybackMonths
  };
  
  return this.savings;
};

ProposalSchema.virtual('isExpired').get(function() {
  return this.validUntil && new Date() > this.validUntil;
});

ProposalSchema.virtual('daysLeft').get(function() {
  if (!this.validUntil) return null;
  const diff = this.validUntil - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

ProposalSchema.statics.checkExpired = async function() {
  return this.updateMany(
    { status: { $in: ['sent', 'viewed'] }, validUntil: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
};

ProposalSchema.index({ clientId: 1 });
ProposalSchema.index({ managerId: 1 });
ProposalSchema.index({ status: 1 });
ProposalSchema.index({ createdAt: -1 });
ProposalSchema.index({ proposalNumber: 1 });

module.exports = mongoose.model('Proposal', ProposalSchema);
