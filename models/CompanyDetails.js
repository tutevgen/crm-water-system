const mongoose = require('mongoose');

const companyDetailsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Тип клиента
  clientType: {
    type: String,
    enum: ['individual', 'ip', 'company'],
    default: 'individual'
  },
  
  // Для ИП и юр.лиц
  fullName: { type: String, trim: true }, // Полное наименование
  shortName: { type: String, trim: true }, // Краткое наименование
  
  // Реквизиты
  inn: { type: String, trim: true, maxlength: 12 },
  kpp: { type: String, trim: true, maxlength: 9 },
  ogrn: { type: String, trim: true, maxlength: 15 },
  okpo: { type: String, trim: true },
  okved: { type: String, trim: true },
  
  // Руководитель
  director: { type: String, trim: true },
  directorPosition: { type: String, trim: true, default: 'Генеральный директор' },
  
  // Адреса
  legalAddress: { type: String, trim: true }, // Юридический адрес
  actualAddress: { type: String, trim: true }, // Фактический адрес
  address: { type: String, trim: true }, // Адрес установки/проживания
  city: { type: String, trim: true },
  region: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  
  // Банковские реквизиты
  bankName: { type: String, trim: true },
  bik: { type: String, trim: true, maxlength: 9 },
  rs: { type: String, trim: true, maxlength: 20 }, // Расчётный счёт
  ks: { type: String, trim: true, maxlength: 20 }, // Корр. счёт
  
  // Контакты (дополнительные)
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  website: { type: String, trim: true },
  
  // Для физлиц
  individual: {
    lastName: { type: String, trim: true },
    firstName: { type: String, trim: true },
    middleName: { type: String, trim: true },
    passport: {
      series: String,
      number: String,
      issuedBy: String,
      issuedDate: Date,
      code: String // Код подразделения
    },
    birthDate: Date
  },
  
  // Налогообложение
  taxSystem: {
    type: String,
    enum: ['osno', 'usn6', 'usn15', 'envd', 'patent', 'nopd'],
    default: 'osno'
  },
  isVatPayer: { type: Boolean, default: true },
  
  // Документы
  documents: [{
    type: { type: String }, // contract, act, invoice, etc.
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }]
  
}, {
  timestamps: true
});

// Индексы
companyDetailsSchema.index({ userId: 1 });
companyDetailsSchema.index({ inn: 1 });
companyDetailsSchema.index({ clientType: 1 });

// Виртуальное поле - полное ФИО для физлиц
companyDetailsSchema.virtual('individual.fullName').get(function() {
  if (!this.individual) return '';
  const parts = [
    this.individual.lastName,
    this.individual.firstName,
    this.individual.middleName
  ].filter(Boolean);
  return parts.join(' ');
});

// Метод для получения данных для КП/договора
companyDetailsSchema.methods.getContractData = function() {
  const data = {
    type: this.clientType,
    name: this.fullName || '',
    inn: this.inn || '',
    address: this.legalAddress || this.address || ''
  };
  
  if (this.clientType === 'individual') {
    data.name = this.individual?.fullName || '';
  }
  
  if (this.clientType === 'company' || this.clientType === 'ip') {
    data.kpp = this.kpp || '';
    data.ogrn = this.ogrn || '';
    data.director = this.director || '';
    data.bank = {
      name: this.bankName || '',
      bik: this.bik || '',
      rs: this.rs || '',
      ks: this.ks || ''
    };
  }
  
  return data;
};

// Статический метод для поиска по ИНН
companyDetailsSchema.statics.findByInn = function(inn) {
  return this.findOne({ inn });
};

module.exports = mongoose.model('CompanyDetails', companyDetailsSchema);
