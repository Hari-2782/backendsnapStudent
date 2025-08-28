const express = require('express');
const processController = require('../controllers/processController');

const router = express.Router();

/**
 * @route   GET /api/mindmap/:imageId
 * @desc    Generate mind map from stored image data
 * @access  Public (for development testing)
 */
router.get('/:imageId', processController.generateMindMap.bind(processController));

module.exports = router;
