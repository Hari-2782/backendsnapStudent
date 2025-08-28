const express = require('express');
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 🔧 TEMPORARILY DISABLED AUTH for testing
// router.use(optionalAuth);

/**
 * @route   GET /api/chat/history
 * @desc    Get chat history with auto-generated titles
 * @access  Public (for development testing)
 */
router.get('/history', chatController.getChatHistory.bind(chatController));

/**
 * @route   POST /api/chat/rag
 * @desc    RAG-based chat response with image context
 * @access  Public (for development testing)
 */
router.post('/rag', chatController.chatWithRAG.bind(chatController));

/**
 * @route   DELETE /api/chat/history
 * @desc    Clear chat history
 * @access  Public (for development testing)
 */
router.delete('/history', chatController.clearChatHistory.bind(chatController));

/**
 * @route   GET /api/chat/health
 * @desc    Health check for chat service
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'RAG Chat service is running',
    timestamp: new Date().toISOString(),
    features: [
      'Vision-based RAG responses',
      'Text-based RAG responses',
      'Context-aware conversations',
      'Cached responses for performance',
      'Image and session context integration'
    ]
  });
});

module.exports = router;
