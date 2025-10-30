const FAQ = require('../models/faq');

// Create a new FAQ
exports.createFAQ = async (req, res) => {
  try {
    const { question, answer, visibility } = req.body;

    if (!question || !answer || !visibility) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newFAQ = new FAQ({ question, answer, visibility });
    await newFAQ.save();

    res.status(201).json({ message: 'FAQ created successfully', data: newFAQ });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all FAQs
exports.getAllFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ _id: -1 });
    res.status(200).json(faqs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get visible FAQs only
exports.getVisibleFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({ visibility: "YES" }).sort({ _id: -1 });
    res.status(200).json(faqs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single FAQ by ID
exports.getFAQById = async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    res.status(200).json(faq);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update FAQ
exports.updateFAQ = async (req, res) => {
  try {
    const { question, answer, visibility } = req.body;
    const updatedFAQ = await FAQ.findByIdAndUpdate(
      req.params.id,
      { question, answer, visibility },
      { new: true }
    );

    if (!updatedFAQ) return res.status(404).json({ message: 'FAQ not found' });

    res.status(200).json({ message: 'FAQ updated successfully', data: updatedFAQ });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete FAQ
exports.deleteFAQ = async (req, res) => {
  try {
    const deleted = await FAQ.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'FAQ not found' });
    res.status(200).json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
