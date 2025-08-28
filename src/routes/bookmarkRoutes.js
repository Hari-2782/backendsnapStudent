const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createBookmark,
  getBookmarks,
  getBookmarkById,
  updateBookmark,
  deleteBookmark,
  searchBookmarks,
  getBookmarkStats
} = require('../controllers/bookmarkController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/bookmarks
 * @desc    Create a new bookmark
 * @access  Private
 */
router.post('/', createBookmark);

/**
 * @route   GET /api/bookmarks
 * @desc    Get all bookmarks for the authenticated user
 * @access  Private
 */
router.get('/', getBookmarks);

/**
 * @route   GET /api/bookmarks/search
 * @desc    Search bookmarks by query
 * @access  Private
 */
router.get('/search', searchBookmarks);

/**
 * @route   GET /api/bookmarks/stats
 * @desc    Get bookmark statistics
 * @access  Private
 */
router.get('/stats', getBookmarkStats);

/**
 * @route   GET /api/bookmarks/:id
 * @desc    Get a specific bookmark by ID
 * @access  Private
 */
router.get('/:id', getBookmarkById);

/**
 * @route   PUT /api/bookmarks/:id
 * @desc    Update a bookmark
 * @access  Private
 */
router.put('/:id', updateBookmark);

/**
 * @route   DELETE /api/bookmarks/:id
 * @desc    Delete a bookmark
 * @access  Private
 */
router.delete('/:id', deleteBookmark);

module.exports = router;
