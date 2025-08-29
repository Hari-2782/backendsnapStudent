const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  generateMindmap, 
  getMindmap, 
  updateNode, 
  deleteNode, 
  explainNode,
  explainMindmap,
  addNode,
  getNodeDetails
} = require('../controllers/mindmapController');

const router = express.Router();

// Apply authentication middleware
if (process.env.NODE_ENV === 'development') {
  router.use(optionalAuth);
} else {
  router.use(authenticateToken);
}

/**
 * @route   POST /api/mindmap/:imageId
 * @desc    Generate mindmap from image/PDF content
 * @access  Private
 */
router.post('/:imageId', generateMindmap);

/**
 * @route   GET /api/mindmap/:imageId
 * @desc    Get mindmap by image ID
 * @access  Private
 */
router.get('/:imageId', getMindmap);

/**
 * @route   GET /api/mindmap/:imageId/node/:nodeId
 * @desc    Get specific node details
 * @access  Private
 */
router.get('/:imageId/node/:nodeId', getNodeDetails);

/**
 * @route   POST /api/mindmap/:imageId/node
 * @desc    Add new node to mindmap
 * @access  Private
 */
router.post('/:imageId/node', addNode);

/**
 * @route   PUT /api/mindmap/:imageId/node/:nodeId
 * @desc    Update existing node
 * @access  Private
 */
router.put('/:imageId/node/:nodeId', updateNode);

/**
 * @route   DELETE /api/mindmap/:imageId/node/:nodeId
 * @desc    Delete node from mindmap
 * @access  Private
 */
router.delete('/:imageId/node/:nodeId', deleteNode);

/**
 * @route   POST /api/mindmap/:imageId/node/:nodeId/explain
 * @desc    Get AI explanation for a specific node
 * @access  Private
 */
router.post('/:imageId/node/:nodeId/explain', explainNode);

/**
 * @route   POST /api/mindmap/:imageId/explain
 * @desc    Get AI explanation for the entire mindmap
 * @access  Private
 */
router.post('/:imageId/explain', explainMindmap);

module.exports = router;
