// seedAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const User = require('./models/User');

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ login: 'info@nova-filter.ru' });
  if (existing) {
    console.log('Администратор уже существует');
    return process.exit();
  }

  // Пароль из переменной окружения или генерация случайного
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(password, 10);

  const admin = new User({
    name: 'Администратор',
    login: 'info@nova-filter.ru',
    email: 'info@nova-filter.ru',
    isPhone: false,
    password: hash,
    role: 'admin',
    isVerified: true
  });

  await admin.save();
  
  if (!process.env.ADMIN_PASSWORD) {
    console.log('✅ Администратор создан');
    console.log(`📧 Логин: info@nova-filter.ru`);
    console.log(`🔑 Пароль: ${password}`);
    console.log('⚠️  ОБЯЗАТЕЛЬНО сохраните пароль и смените его после первого входа!');
  } else {
    console.log('✅ Администратор создан с паролем из ADMIN_PASSWORD');
  }
  
  process.exit();
}

createAdmin();
