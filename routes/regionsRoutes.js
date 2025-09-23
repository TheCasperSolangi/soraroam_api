const express = require('express');
const router = express.Router();
const regionsController = require('../controllers/regionsController');

// CRUD routes
router.post('/', regionsController.createRegion);          // Create
router.get('/', regionsController.getAllRegions);         // Read all
router.get('/:id', regionsController.getRegionById);      // Read one
router.put('/:id', regionsController.updateRegion);       // Update
router.delete('/:id', regionsController.deleteRegion);    // Delete

module.exports = router;
