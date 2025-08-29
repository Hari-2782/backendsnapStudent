const express = require('express');
const processController = require('../controllers/processController');

const router = express.Router();

// 🔧 TEMPORARILY DISABLED AUTH for testing
// No authentication required for development testing
// router.use(optionalAuth); // Commented out for now

/**
 * @route   POST /api/process
 * @desc    Process file (image or PDF) through OCR/NLP → embeddings pipeline
 * @access  Public (for development testing)
 */
router.post('/', processController.processFile.bind(processController));

/**
 * @route   GET /api/process/status/:fileId
 * @desc    Get processing status for a file
 * @access  Public (for development testing)
 */
router.get('/status/:fileId', processController.getProcessingStatus.bind(processController));

module.exports = router;
