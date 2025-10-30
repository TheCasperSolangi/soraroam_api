const Article = require('../models/articleSchema'); // Should be renamed to Articles.js for clarity

// Create an article
exports.createArticle = async (req, res) => {
  try {
    const newArticle = new Article(req.body);
    const saved = await newArticle.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Error creating article', error });
  }
};

// Get all articles
exports.getAllArticles = async (req, res) => {
  try {
    const articles = await Article.find().sort({ createdAt: -1 });
    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching articles', error });
  }
};

// Get a single article by code
exports.getArticleByCode = async (req, res) => {
  try {
    const article = await Article.findOne({ article_code: req.params.code });
    if (!article) return res.status(404).json({ message: 'Article not found' });
    res.status(200).json(article);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching article', error });
  }
};

// Update an article by code
exports.updateArticle = async (req, res) => {
  try {
    const updated = await Article.findOneAndUpdate(
      { article_code: req.params.code },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Article not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating article', error });
  }
};

// Delete an article by code
exports.deleteArticle = async (req, res) => {
  try {
    const deleted = await Article.findOneAndDelete({ article_code: req.params.code });
    if (!deleted) return res.status(404).json({ message: 'Article not found' });
    res.status(200).json({ message: 'Article deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting article', error });
  }
};