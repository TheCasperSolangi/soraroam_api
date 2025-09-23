const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

const ESIMGo = require('./index');
const { errorHandler, ValidationError } = require('./utils/errors');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: process.env.RATE_LIMIT_REQUESTS || 100, // Number of requests
  duration: process.env.RATE_LIMIT_WINDOW || 60, // Per 60 seconds
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: secs
    });
  }
});

// Initialize ESIMGo client
let esimgo;
try {
  if (!process.env.ESIMGO_API_KEY) {
    console.warn('ESIMGO_API_KEY not found in environment variables');
  } else {
    esimgo = new ESIMGo(process.env.ESIMGO_API_KEY, {
      baseURL: process.env.ESIMGO_BASE_URL,
      timeout: parseInt(process.env.ESIMGO_TIMEOUT) || 30000
    });
    console.log('ESIMGo client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize ESIMGo client:', error.message);
}

// Middleware to ensure ESIMGo client is available
const requireESIMGo = (req, res, next) => {
  if (!esimgo) {
    return res.status(500).json({
      error: 'ESIMGo client not initialized. Check API key configuration.'
    });
  }
  req.esimgo = esimgo;
  next();
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ESIMGo API Wrapper',
      version: '1.0.0'
    };

    if (esimgo) {
      const apiHealth = await esimgo.healthCheck();
      health.esimgoApi = apiHealth;
    } else {
      health.esimgoApi = { status: 'not_configured' };
    }

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API endpoints

// Orders endpoints
app.get('/api/orders', requireESIMGo, async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      includeEsimData: req.query.includeEsimData === 'true',
      createdAtGte: req.query.createdAtGte,
      createdAtLte: req.query.createdAtLte
    };

    const orders = await req.esimgo.orders.getOrders(options);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/:orderRef', requireESIMGo, async (req, res, next) => {
  try {
    const order = await req.esimgo.orders.getOrder(req.params.orderRef);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', requireESIMGo, async (req, res, next) => {
  try {
    const order = await req.esimgo.orders.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/stats', requireESIMGo, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const stats = await req.esimgo.orders.getOrderStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// eSIMs endpoints
app.get('/api/esims', requireESIMGo, async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      status: req.query.status,
      profileStatus: req.query.profileStatus
    };

    const esims = await req.esimgo.esims.getESIMs(options);
    res.json(esims);
  } catch (error) {
    next(error);
  }
});

app.get('/api/esims/:iccid', requireESIMGo, async (req, res, next) => {
  try {
    const esim = await req.esimgo.getESIMInfo(req.params.iccid);
    res.json(esim);
  } catch (error) {
    next(error);
  }
});

app.put('/api/esims/:iccid', requireESIMGo, async (req, res, next) => {
  try {
    const esim = await req.esimgo.esims.updateESIM(req.params.iccid, req.body);
    res.json(esim);
  } catch (error) {
    next(error);
  }
});

app.get('/api/esims/:iccid/bundles', requireESIMGo, async (req, res, next) => {
  try {
    const bundles = await req.esimgo.esims.getESIMBundles(req.params.iccid, {
      includeExpired: req.query.includeExpired === 'true'
    });
    res.json(bundles);
  } catch (error) {
    next(error);
  }
});

app.post('/api/esims/:iccid/suspend', requireESIMGo, async (req, res, next) => {
  try {
    const result = await req.esimgo.esims.suspendESIM(req.params.iccid, req.body.reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/esims/:iccid/resume', requireESIMGo, async (req, res, next) => {
  try {
    const result = await req.esimgo.esims.resumeESIM(req.params.iccid);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/esims/assignments', requireESIMGo, async (req, res, next) => {
  try {
    const references = {
      orderRef: req.query.orderRef,
      applyRef: req.query.applyRef
    };
    const format = req.query.format || 'json';

    const assignments = await req.esimgo.esims.getESIMInstallDetails(references, format);
    
    if (format === 'zip') {
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename=qr-codes.zip');
    }
    
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// Bundles endpoints
app.get('/api/bundles', requireESIMGo, async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      country: req.query.country,
      region: req.query.region,
      type: req.query.type,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined
    };

    const bundles = await req.esimgo.bundles.getBundles(options);
    res.json(bundles);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bundles/search', requireESIMGo, async (req, res, next) => {
  try {
    const searchCriteria = {
      destination: req.query.destination,
      dataAmount: req.query.dataAmount ? parseInt(req.query.dataAmount) : undefined,
      validity: req.query.validity ? parseInt(req.query.validity) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      currency: req.query.currency
    };

    const results = await req.esimgo.bundles.searchBundles(searchCriteria);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bundles/recommendations/:destination', requireESIMGo, async (req, res, next) => {
  try {
    const preferences = {
      dataAmount: req.query.dataAmount ? parseInt(req.query.dataAmount) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      maxValidity: req.query.maxValidity ? parseInt(req.query.maxValidity) : undefined
    };

    const recommendations = await req.esimgo.findBestBundles(req.params.destination, preferences);
    res.json(recommendations);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bundles/:bundleId', requireESIMGo, async (req, res, next) => {
  try {
    const bundle = await req.esimgo.bundles.getBundle(req.params.bundleId);
    res.json(bundle);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bundles/countries', requireESIMGo, async (req, res, next) => {
  try {
    const countries = await req.esimgo.bundles.getSupportedCountries();
    res.json(countries);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bundles/regions', requireESIMGo, async (req, res, next) => {
  try {
    const regions = await req.esimgo.bundles.getSupportedRegions();
    res.json(regions);
  } catch (error) {
    next(error);
  }
});

// Account endpoints
app.get('/api/account', requireESIMGo, async (req, res, next) => {
  try {
    const account = await req.esimgo.getAccountSummary();
    res.json(account);
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/balance', requireESIMGo, async (req, res, next) => {
  try {
    const balance = await req.esimgo.account.getBalance();
    res.json(balance);
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/transactions', requireESIMGo, async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      type: req.query.type,
      status: req.query.status
    };

    const transactions = await req.esimgo.account.getTransactionHistory(options);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

// Provisioning endpoint (convenience method)
app.post('/api/provision', requireESIMGo, async (req, res, next) => {
  try {
    const result = await req.esimgo.provisionESIM(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`ESIMGo API Wrapper server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;