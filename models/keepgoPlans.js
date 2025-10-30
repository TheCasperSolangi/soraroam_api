const mongoose = require('mongoose');

const keepgoPlansSchema = new mongoose.Schema({
  country: { type: String, required: true, unique: true },

  '7days_1gb': { type: Number, required: true },
  '30days_3gb': { type: Number, required: true },
  '30days_5gb': { type: Number, required: true },
  '30days_10gb': { type: Number, required: true },
  '30days_20gb': { type: Number, required: true },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('KeepgoPlan', keepgoPlansSchema);