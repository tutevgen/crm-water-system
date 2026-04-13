const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientName: String,
  clientPhone: String,
  serviceType: {
    type: String,
    required: true,
    enum: ['maintenance', 'refill', 'repair', 'analysis', 'other']
  },
  preferredDate: Date,
  comment: { type: String, trim: true },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'completed', 'cancelled'],
    default: 'new',
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  resolvedComment: String
}, { timestamps: true });

serviceRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
