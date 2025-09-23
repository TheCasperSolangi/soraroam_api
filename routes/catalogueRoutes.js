
const express = require('express');
const router = express.Router();
const {
  getEsimgoCatalogue,
  getSpecificBundle,
  createPaymentIntent,
  confirmPaymentAndCreateEsim,
  handleStripeWebhook,
  getPaymentStatus,
  getOrderDetails,
  getEsimDetails,
} = require('../controllers/catalogueController');

// Middleware for raw body parsing (needed for Stripe webhooks)
const rawBodyMiddleware = (req, res, next) => {
  if (req.originalUrl === '/api/esim/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
};

// Apply middleware
router.use(rawBodyMiddleware);

// eSIM Catalogue routes
router.get('/catalogue', getEsimgoCatalogue);
router.get('/bundle/:name', getSpecificBundle);

// Payment routes
router.post('/create-payment-intent', createPaymentIntent);
router.post('/confirm-payment', confirmPaymentAndCreateEsim);
router.get('/payment-status/:paymentIntentId', getPaymentStatus);

// Stripe webhook (must be before json middleware)
router.post('/webhook', handleStripeWebhook);

// Order and eSIM management routes
router.get('/orders/:orderId', getOrderDetails);
router.get('/esims/:iccid', getEsimDetails);

module.exports = router;