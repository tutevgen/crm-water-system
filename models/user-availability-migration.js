/**
 * Патч для модели User — добавить ПЕРЕД строкой "discount: {"
 * Файл: models/User.js
 * 
 * Добавляет поля статуса доступности для монтажников/менеджеров
 */

// ========== ВСТАВИТЬ В models/User.js ПЕРЕД полем discount ==========

/*
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
    type: Date  // До какой даты недоступен
  },
*/

// ========== Миграция — запустить один раз: node user-availability-migration.js ==========

const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const result = await mongoose.connection.db.collection('users').updateMany(
    { availability: { $exists: false } },
    { $set: { availability: 'available', availabilityNote: '', availabilityUntil: null } }
  );
  
  console.log(`✅ Обновлено ${result.modifiedCount} пользователей — поле availability добавлено`);
  process.exit();
}

migrate().catch(err => { console.error(err); process.exit(1); });
