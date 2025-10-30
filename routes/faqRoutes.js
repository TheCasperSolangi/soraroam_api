const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');

// Create FAQ
router.post('/', faqController.createFAQ);

// Get all FAQs
router.get('/', faqController.getAllFAQs);

// Get visible FAQs (only visibility: YES)
router.get('/visible', faqController.getVisibleFAQs);

// Get FAQ by ID
router.get('/:id', faqController.getFAQById);

// Update FAQ
router.put('/:id', faqController.updateFAQ);

// Delete FAQ
router.delete('/:id', faqController.deleteFAQ);

module.exports = router;