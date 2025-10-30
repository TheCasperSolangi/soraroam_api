const mongoose = require('mongoose');

const esimgoPlansSchema = new mongoose.Schema({
  country: { type: String, required: true },

  // Fixed data plans
  '7days_1gb': { type: Number},
  '15days_2gb': { type: Number },
  '30days_3gb': { type: Number },
  '30days_5gb': { type: Number },
  '30days_10gb': { type: Number },
  '30days_20gb': { type: Number },
  '30days_50gb': {type: Number},
  '30days_100gb': {type:Number},

  // Unlimited plans
  '1_day_unlimited': { type: Number },
  '3_day_unlimited': { type: Number },
  '5_day_unlimited': { type: Number },
  '7_day_unlimited': { type: Number },
  '10_day_unlimited': { type: Number },
  '15_day_unlimited': { type: Number },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EsimgoPlan', esimgoPlansSchema);