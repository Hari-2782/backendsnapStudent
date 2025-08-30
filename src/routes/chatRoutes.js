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
 * @route   GET /api/chat/history/image/:imageId
 * @desc    Get chat history filtered by specific image context
 * @access  Public (for development testing)
 */
router.get('/history/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user?._id || req.query.userId || 'dev-user-123';
    const { limit = 20 } = req.query;

    console.log(`📚 Fetching chat history for image ${imageId} and user ${userId}`);

    const historyEntries = await chatController.ChatHistoryEntry.getChatHistoryByImage(
      userId, 
      imageId, 
      parseInt(limit)
    );

    // Group by session for better organization
    const groupedHistory = chatController.groupHistoryBySession(historyEntries);

    const historyData = groupedHistory.map(group => ({
      id: group.sessionId,
      title: group.title,
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      messageCount: group.messages.length,
      imageContext: {
        imageId: imageId,
        totalMessages: historyEntries.length
      }
    }));

    return res.json({
      status: 'success',
      message: `Chat history retrieved for image ${imageId}`,
      data: historyData,
      summary: {
        imageId,
        totalSessions: historyData.length,
        totalMessages: historyEntries.length,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Image chat history error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch image chat history',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/chat/history/session/:sessionId
 * @desc    Get chat history for a specific session
 * @access  Public (for development testing)
 */
router.get('/history/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?._id || req.query.userId || 'dev-user-123';
    const { limit = 50 } = req.query;

    console.log(`📚 Fetching chat history for session ${sessionId} and user ${userId}`);

    const historyEntries = await chatController.ChatHistoryEntry.find({
      userId,
      sessionId
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('context.evidenceIds', 'text imageUrl ocrConfidence')
    .populate('relatedContent.sessionIds', 'title description');

    // Group by session
    const groupedHistory = chatController.groupHistoryBySession(historyEntries);

    const historyData = groupedHistory.map(group => ({
      id: group.sessionId,
      title: group.title,
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      messageCount: group.messages.length,
      sessionContext: {
        sessionId: sessionId,
        totalMessages: historyEntries.length
      }
    }));

    return res.json({
      status: 'success',
      message: `Chat history retrieved for session ${sessionId}`,
      data: historyData,
      summary: {
        sessionId,
        totalSessions: historyData.length,
        totalMessages: historyEntries.length,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Session chat history error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch session chat history',
      error: error.message
    });
  }
});

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
    message: 'Enhanced RAG Chat service is running',
    timestamp: new Date().toISOString(),
    features: [
      'Vision-based RAG responses',
      'Text-based RAG responses',
      'Context-aware conversations',
      'Enhanced chat history storage',
      'Image and session context integration',
      'Comprehensive message metadata',
      'Intent and topic detection',
      'Cached responses for performance',
      'Multi-modal context retrieval'
    ],
    endpoints: {
      'GET /history': 'Get general chat history',
      'GET /history/image/:imageId': 'Get chat history by image context',
      'GET /history/session/:sessionId': 'Get chat history by session',
      'POST /rag': 'RAG-based chat with context',
      'DELETE /history': 'Clear chat history',
      'GET /health': 'Service health check'
    }
  });
});

module.exports = router;
