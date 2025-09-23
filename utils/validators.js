const Joi = require('joi');

// ICCID validation (typically 19-20 digits)
function validateIccid(iccid) {
  if (!iccid || typeof iccid !== 'string') {
    return false;
  }
  
  // Remove any non-digit characters and check length
  const cleanIccid = iccid.replace(/\D/g, '');
  return cleanIccid.length >= 19 && cleanIccid.length <= 20;
}

// Email validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone number validation (basic international format)
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
}

// Date validation (ISO 8601 format)
function validateDateRange(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.includes('T');
  } catch (error) {
    return false;
  }
}

// Pagination parameters validation
function validatePaginationParams(page, limit) {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('Page must be a positive integer');
  }
  
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be a positive integer between 1 and 100');
  }
  
  return true;
}

// Country code validation (ISO 3166-1 alpha-2)
function validateCountryCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  return /^[A-Z]{2}$/.test(code.toUpperCase());
}

// Currency code validation (ISO 4217)
function validateCurrencyCode(currency) {
  if (!currency || typeof currency !== 'string') {
    return false;
  }
  
  const commonCurrencies = [
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
    'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'ZAR', 'BRL', 'INR', 'KRW', 'PLN'
  ];
  
  return commonCurrencies.includes(currency.toUpperCase());
}

// Bundle ID validation
function validateBundleId(bundleId) {
  if (!bundleId || typeof bundleId !== 'string') {
    return false;
  }
  
  // Bundle IDs are typically alphanumeric with underscores/hyphens
  return /^[a-zA-Z0-9_-]{3,50}$/.test(bundleId);
}

// Order reference validation
function validateOrderReference(orderRef) {
  if (!orderRef || typeof orderRef !== 'string') {
    return false;
  }
  
  return /^[a-zA-Z0-9_-]{5,100}$/.test(orderRef);
}

// Amount validation (for pricing, balances, etc.)
function validateAmount(amount, currency = 'USD') {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return false;
  }
  
  // Amount should be positive and within reasonable limits
  if (amount < 0 || amount > 999999.99) {
    return false;
  }
  
  // Check decimal places based on currency
  const decimalPlaces = amount.toString().split('.')[1]?.length || 0;
  
  // Most currencies use 2 decimal places, some use 0 (JPY, KRW)
  const noCentseCurrencies = ['JPY', 'KRW', 'VND', 'IDR'];
  const maxDecimals = noCentseCurrencies.includes(currency) ? 0 : 2;
  
  return decimalPlaces <= maxDecimals;
}

// Joi schemas for complex validation
const schemas = {
  // Order creation schema
  createOrder: Joi.object({
    items: Joi.array().items(
      Joi.object({
        bundleId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).max(100).required(),
        customPrice: Joi.number().positive().optional()
      })
    ).min(1).required(),
    allowReassign: Joi.boolean().default(false),
    customerReference: Joi.string().max(100).optional(),
    metadata: Joi.object().optional()
  }),

  // Account settings schema
  accountSettings: Joi.object({
    companyName: Joi.string().max(200).optional(),
    contactEmail: Joi.string().email().optional(),
    billingAddress: Joi.object({
      street: Joi.string().max(200).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      zipCode: Joi.string().max(20).optional(),
      country: Joi.string().length(2).uppercase().optional()
    }).optional(),
    notifications: Joi.object({
      email: Joi.boolean().default(true),
      sms: Joi.boolean().default(false),
      webhook: Joi.boolean().default(false)
    }).optional(),
    timezone: Joi.string().optional(),
    language: Joi.string().length(2).lowercase().optional()
  }),

  // eSIM update schema
  esimUpdate: Joi.object({
    customerReference: Joi.string().max(100).optional(),
    alias: Joi.string().max(50).optional(),
    metadata: Joi.object().optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
  }),

  // Bundle search schema
  bundleSearch: Joi.object({
    destination: Joi.string().max(100).optional(),
    dataAmount: Joi.number().positive().optional(),
    validity: Joi.number().integer().positive().max(365).optional(),
    maxPrice: Joi.number().positive().optional(),
    currency: Joi.string().length(3).uppercase().optional(),
    type: Joi.string().valid('data', 'voice', 'sms', 'combo').optional()
  }),

  // API key generation schema
  apiKeyGeneration: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    permissions: Joi.array().items(
      Joi.string().valid(
        'orders:read', 'orders:write',
        'esims:read', 'esims:write',
        'bundles:read', 'account:read'
      )
    ).min(1).required(),
    expiresAt: Joi.date().greater('now').optional(),
    ipWhitelist: Joi.array().items(Joi.string().ip()).optional()
  })
};

// Validation helper function
function validateWithSchema(data, schemaName) {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Unknown validation schema: ${schemaName}`);
  }

  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    const validationError = new Error('Validation failed');
    validationError.details = details;
    throw validationError;
  }

  return value;
}

// Rate limiting validation
function validateRateLimit(windowMs, maxRequests) {
  if (!Number.isInteger(windowMs) || windowMs < 1000) {
    throw new Error('Window must be at least 1000ms');
  }
  
  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new Error('Max requests must be a positive integer');
  }
  
  return true;
}

module.exports = {
  validateIccid,
  validateEmail,
  validatePhoneNumber,
  validateDateRange,
  validatePaginationParams,
  validateCountryCode,
  validateCurrencyCode,
  validateBundleId,
  validateOrderReference,
  validateAmount,
  validateWithSchema,
  validateRateLimit,
  schemas
};