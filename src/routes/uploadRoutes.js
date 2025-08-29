const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { uploadImage, getImage, deleteImage, upload, flexibleUpload } = require('../controllers/uploadController');

const router = express.Router();

// Apply authentication middleware to all routes
// For development, we'll use optional auth to allow testing without tokens
if (process.env.NODE_ENV === 'development') {
  router.use(optionalAuth);
} else {
  router.use(authenticateToken);
}

/**
 * @route   POST /api/upload
 * @desc    Upload and preprocess an image or PDF file
 * @access  Private
 */
router.post('/', flexibleUpload, uploadImage);

/**
 * @route   GET /api/upload/:imageId
 * @desc    Get file information by ID
 * @access  Private
 */
router.get('/:imageId', getImage);

/**
 * @route   DELETE /api/upload/:imageId
 * @desc    Delete a file
 * @access  Private
 */
router.delete('/:imageId', deleteImage);

module.exports = router;
