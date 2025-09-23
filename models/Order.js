const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  order_code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  provider_reference_code: {
    type: String,
    trim: true,
  },
  // Stripe payment fields
  paymentIntentId: {
    type: String,
    trim: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    trim: true,
  },
  // Order details from provider
  order: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'paid', 'payment_failed'],
    default: 'pending',
  },
  statusMessage: {
    type: String,
    trim: true,
  },
  orderReference: {
    type: String,
    trim: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  assigned: {
    type: Boolean,
    default: false,
  },
  // Bundle information
  bundleName: {
    type: String,
    trim: true,
  },
  bundleDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Customer information
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  customerPhone: {
    type: String,
    trim: true,
  },
  // eSIM specific fields
  esimData: {
    iccid: {
      type: String,
      trim: true,
    },
    activationCode: {
      type: String,
      trim: true,
    },
    qrCodeUrl: {
      type: String,
      trim: true,
    },
    dataUsage: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
OrderSchema.index({ username: 1, createdAt: -1 });
OrderSchema.index({ order_code: 1 });
OrderSchema.index({ paymentIntentId: 1 });
OrderSchema.index({ provider_reference_code: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });

// Virtual for order age
OrderSchema.virtual('orderAge').get(function() {
  return Date.now() - this.createdAt;
});

// Pre-save middleware to update the updatedAt field
OrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if order is completed
OrderSchema.methods.isCompleted = function() {
  return this.status === 'completed' && this.paymentStatus === 'completed';
};

// Method to check if payment is successful
OrderSchema.methods.isPaymentSuccessful = function() {
  return this.paymentStatus === 'completed';
};

// Static method to find orders by username
OrderSchema.statics.findByUsername = function(username, limit = 10) {
  return this.find({ username })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find pending payments
OrderSchema.statics.findPendingPayments = function() {
  return this.find({ 
    paymentStatus: { $in: ['pending', 'processing'] },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  });
};

module.exports = mongoose.model('Order', OrderSchema);