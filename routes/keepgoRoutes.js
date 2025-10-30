const express = require('express');
const router = express.Router();
const { getKeepgoBundles, getSpecificDataPlan } = require('../controllers/keepgoController');

// ✅ Define the route
router.get('/bundles', getKeepgoBundles);
router.get("/specific", getSpecificDataPlan);
module.exports = router;