const express = require('express');
const router = express.Router();
const { createPlan, getAllPlans, updatePlan, uploadCSV, bulkUploadPlans } = require('../controllers/keepgoPlansController');

router.post('/', createPlan);     // POST /api/keepgo-plans  → Create new plan
router.get('/', getAllPlans);     // GET  /api/keepgo-plans  → Get all plans
router.put('/:id', updatePlan);   // PUT  /api/keepgo-plans/:id → Edit plan by ID
router.post('/bulk-upload', uploadCSV, bulkUploadPlans);
module.exports = router;