const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  date: { type: Date, required: true, index: true },
  time: { type: String }, // "09:00"
  // Ссылки на сущности
  linkedType: { type: String, enum: ['proposal', 'request', 'client', 'custom'], default: 'custom' },
  linkedId: { type: mongoose.Schema.Types.ObjectId },
  linkedUrl: { type: String }, // URL для перехода
  // Кто создал
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: String,
  // Назначено
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Приоритет
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  color: { type: String, default: '#6366f1' },
  isCompleted: { type: Boolean, default: false },
  completedAt: Date
}, { timestamps: true });

reminderSchema.index({ date: 1, createdBy: 1 });
reminderSchema.index({ assignedTo: 1, date: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
