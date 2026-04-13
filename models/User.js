const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true,
    minlength: [2, 'Имя должно содержать минимум 2 символа'],
    maxlength: [100, 'Имя не должно превышать 100 символов']
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        // Если email не указан, валидация проходит
        if (!v) return true;
        // Улучшенное регулярное выражение для email
        return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
      },
      message: props => `${props.value} — некорректный email`
    }
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Если телефон не указан, валидация проходит
        if (!v) return true;
        // Проверка формата телефона (международный формат)
        return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(v);
      },
      message: props => `${props.value} — некорректный номер телефона`
    }
  },
  login: {
    type: String,
    required: [true, 'Логин обязателен'],
    unique: true,
    trim: true,
    minlength: [3, 'Логин должен содержать минимум 3 символа'],
    maxlength: [50, 'Логин не должен превышать 50 символов']
  },
  isPhone: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [6, 'Пароль должен быть не короче 6 символов']
  },
  role: {
    type: String,
    enum: {
      values: ['client', 'installer', 'manager', 'admin'],
      message: '{VALUE} не является допустимой ролью'
    },
    default: 'client'
  },
  avatar: {
    type: String,
    default: null
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Адрес не должен превышать 500 символов']
  },
  orgDetails: {
    companyName: {
      type: String,
      trim: true,
      maxlength: [200, 'Название компании не должно превышать 200 символов']
    },
    inn: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // ИНН: 10 или 12 цифр
          return /^\d{10}$|^\d{12}$/.test(v);
        },
        message: 'ИНН должен содержать 10 или 12 цифр'
      }
    },
    kpp: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // КПП: 9 цифр
          return /^\d{9}$/.test(v);
        },
        message: 'КПП должен содержать 9 цифр'
      }
    },
    legalAddress: {
      type: String,
      trim: true,
      maxlength: [500, 'Юридический адрес не должен превышать 500 символов']
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: [200, 'Название банка не должно превышать 200 символов']
    },
    bik: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // БИК: 9 цифр
          return /^\d{9}$/.test(v);
        },
        message: 'БИК должен содержать 9 цифр'
      }
    },
    rs: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // Расчетный счет: 20 цифр
          return /^\d{20}$/.test(v);
        },
        message: 'Расчетный счет должен содержать 20 цифр'
      }
    },
    ks: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // Корреспондентский счет: 20 цифр
          return /^\d{20}$/.test(v);
        },
        message: 'Корреспондентский счет должен содержать 20 цифр'
      }
    }
  },
  // Статус доступности (для монтажников и менеджеров)
  availability: {
    type: String,
    enum: ['available', 'busy', 'vacation', 'sick', 'day_off'],
    default: 'available'
  },
  availabilityNote: {
    type: String,
    trim: true,
    maxlength: 200
  },
  availabilityUntil: {
    type: Date
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Скидка не может быть отрицательной'],
    max: [100, 'Скидка не может превышать 100%'],
    validate: {
      validator: Number.isInteger,
      message: 'Скидка должна быть целым числом'
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    select: false // Не возвращать в обычных запросах
  },
  verificationExpires: {
    type: Date,
    select: false
  },
  // Поля для сброса пароля
  resetPasswordCode: {
    type: String,
    select: false // Не возвращать в обычных запросах
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Автоматически управляет createdAt и updatedAt
});

// Индексы для оптимизации запросов
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ login: 1 });
userSchema.index({ isActive: 1 });

// Pre-save хук для хеширования пароля
userSchema.pre('save', async function(next) {
  // Хешируем пароль только если он был изменен
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Метод для проверки пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Ошибка при проверке пароля');
  }
};

// Метод для получения публичных данных пользователя
userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    login: this.login,
    role: this.role,
    avatar: this.avatar,
    address: this.address,
    discount: this.discount,
    isVerified: this.isVerified,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// Метод для генерации кода верификации
userSchema.methods.generateVerificationCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verificationCode = code;
  this.verificationExpires = Date.now() + 15 * 60 * 1000; // 15 минут
  return code;
};

// Метод для генерации кода сброса пароля
userSchema.methods.generateResetPasswordCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetPasswordCode = code;
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 минут
  return code;
};

// Статический метод для поиска по логину (email, phone или login)
userSchema.statics.findByLogin = async function(loginValue) {
  const normalizedLogin = loginValue.trim().toLowerCase();
  
  // Ищем по всем возможным полям
  return await this.findOne({
    $or: [
      { email: normalizedLogin },
      { phone: loginValue.trim() }, // телефон не приводим к lowercase
      { login: normalizedLogin }
    ]
  });
};

module.exports = mongoose.model('User', userSchema);