const express = require('express');
const processController = require('../controllers/processController');

const router = express.Router();

// 🔧 TEMPORARILY DISABLED AUTH for testing
// No authentication required for development testing
// router.use(optionalAuth); // Commented out for now

/**
 * @route   POST /api/process
 * @desc    Process image through OCR → NLP → embeddings pipeline
 * @access  Public (for development testing)
 */
router.post('/', processController.processImage.bind(processController));

/**
 * @route   GET /api/process/status/:imageId
 * @desc    Get processing status for an image
 * @access  Public (for development testing)
 */
router.get('/status/:imageId', processController.getProcessingStatus.bind(processController));

module.exports = router;
