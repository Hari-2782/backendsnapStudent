const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  semanticSearch,
  textSearch,
  advancedSearch,
  getSearchSuggestions
} = require('../controllers/searchController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/search/semantic
 * @desc    Perform semantic search across user content
 * @access  Private
 */
router.get('/semantic', semanticSearch);

/**
 * @route   GET /api/search/text
 * @desc    Perform text-based search across user content
 * @access  Private
 */
router.get('/text', textSearch);

/**
 * @route   POST /api/search/advanced
 * @desc    Perform advanced search with filters
 * @access  Private
 */
router.post('/advanced', advancedSearch);

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions based on user content
 * @access  Private
 */
router.get('/suggestions', getSearchSuggestions);

module.exports = router;
