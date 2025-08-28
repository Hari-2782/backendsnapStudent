const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { uploadImage, getImage, deleteImage, upload } = require('../controllers/uploadController');

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
 * @desc    Upload and preprocess an image
 * @access  Private
 */
router.post('/', upload.single('image'), uploadImage);

/**
 * @route   GET /api/upload/:imageId
 * @desc    Get image information by ID
 * @access  Private
 */
router.get('/:imageId', getImage);

/**
 * @route   DELETE /api/upload/:imageId
 * @desc    Delete an image
 * @access  Private
 */
router.delete('/:imageId', deleteImage);

module.exports = router;
