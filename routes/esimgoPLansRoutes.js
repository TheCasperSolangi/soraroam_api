const express = require('express');
const router = express.Router();
const { createPlan, getAllPlans, updatePlan, bulkUploadEsimgoPlans } = require('../controllers/esimgoPlansController');
const multer = require('multer');
router.post('/', createPlan);     // POST /api/esimgo-plans  → Create new plan
router.get('/', getAllPlans);     // GET  /api/esimgo-plans  → Get all plans
router.put('/:id', updatePlan);   // PUT  /api/esimgo-plans/:id → Edit plan by ID
const upload = multer({ dest: 'uploads/' });

router.post('/bulk-upload', upload.single('file'), bulkUploadEsimgoPlans);
module.exports = router;