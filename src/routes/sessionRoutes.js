const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const sessionController = require('../controllers/sessionController');
const Session = require('../models/Session');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all sessions for a user (rich list for History page)
router.get('/', sessionController.getAllSessions.bind(sessionController));

// Create a new session
router.post('/', sessionController.createSession.bind(sessionController));

// Add chat message to session
router.post('/:sessionId/chat', sessionController.addChatMessage.bind(sessionController));

// Get session with full chat history
router.get('/:sessionId/chat', sessionController.getSessionWithChat.bind(sessionController));

// Update session
router.put('/:sessionId', sessionController.updateSession.bind(sessionController));

/**
 * @route   POST /api/sessions/:id/like
 * @desc    Like or unlike a session. Body: { like?: boolean }
 * @access  Private
 */
router.post('/:id/like', async (req, res) => {
  try {
    const userId = req.user._id;
    const { like } = req.body || {};
    const session = await Session.findOne({ sessionId: req.params.id, userId });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    const already = Array.isArray(session.likedBy) && session.likedBy.some((u) => String(u) === String(userId));
    const doLike = typeof like === 'boolean' ? like : !already;
    if (doLike && !already) {
      session.likedBy.push(userId);
      session.likes = (session.likes || 0) + 1;
    } else if (!doLike && already) {
      session.likedBy = session.likedBy.filter((u) => String(u) !== String(userId));
      session.likes = Math.max(0, (session.likes || 0) - 1);
    }
    await session.save();
    res.status(200).json({ success: true, likes: session.likes, liked: doLike });
  } catch (error) {
    console.error('Like session error:', error);
    res.status(500).json({ success: false, error: 'Failed to like session' });
  }
});

// Get a specific session
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reopen a session: return session and its chat transcript (user+assistant)
router.get('/:sessionId/reopen', async (req, res) => {
  try {
    const userId = req.user._id;
    const session = await Session.findOne({ sessionId: req.params.sessionId, userId });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    const title = typeof session.computeDisplayTitle === 'function' ? session.computeDisplayTitle() : (session.title || `Study Session ${session.sessionId}`);
    const chat = Array.isArray(session.chat) ? session.chat : [];
    res.status(200).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        title,
        description: session.description,
        tags: session.tags || [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      chat,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get mindmap data (for frontend compatibility)
router.get('/mindmap/latest', async (req, res) => {
  try {
    const latestSession = await Session.findOne(
      { userId: req.user?._id || 'dev-user-123' },
      {},
      { sort: { createdAt: -1 } }
    );
    
    if (!latestSession) {
      return res.json([]); // Return empty array if no sessions
    }
    
    // Convert session nodes to mindmap format
    const mindmapNodes = latestSession.nodes.map(node => ({
      id: node.id,
      label: node.content,
      x: node.position.x,
      y: node.position.y,
      level: 0, // Will be computed by frontend
      children: [],
      parent: undefined
    }));
    
    // Add edges to create parent-child relationships
    latestSession.edges.forEach(edge => {
      const sourceNode = mindmapNodes.find(n => n.id === edge.source);
      const targetNode = mindmapNodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        sourceNode.children.push(targetNode.id);
        targetNode.parent = sourceNode.id;
      }
    });
    
    res.json(mindmapNodes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/sessions/:id
 * @desc    Update a session
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, tags } = req.body;
    
    const session = await Session.findOneAndUpdate(
      {
        sessionId: req.params.id,
        userId: req.user._id
      },
      {
        title,
        description,
        status,
        tags
      },
      { new: true, runValidators: true }
    );
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Session updated successfully',
      session
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session'
    });
  }
});

/**
 * @route   DELETE /api/sessions/:id
 * @desc    Delete a session (soft delete)
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      {
        sessionId: req.params.id,
        userId: req.user._id
      },
      { status: 'archived' },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Session archived successfully'
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session'
    });
  }
});

/**
 * @route   POST /api/sessions/:id/nodes
 * @desc    Add a new node to a session
 * @access  Private
 */
router.post('/:id/nodes', async (req, res) => {
  try {
    const { type, content, position, metadata } = req.body;
    
    const session = await Session.findOne({
      sessionId: req.params.id,
      userId: req.user._id
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const newNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      position: position || { x: 0, y: 0 },
      metadata: metadata || {}
    };
    
    session.nodes.push(newNode);
    await session.save();
    
    res.status(201).json({
      success: true,
      message: 'Node added successfully',
      node: newNode
    });
  } catch (error) {
    console.error('Add node error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add node'
    });
  }
});

/**
 * @route   POST /api/sessions/:id/edges
 * @desc    Add a new edge to a session
 * @access  Private
 */
router.post('/:id/edges', async (req, res) => {
  try {
    const { source, target, label, type } = req.body;
    
    const session = await Session.findOne({
      sessionId: req.params.id,
      userId: req.user._id
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const newEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source,
      target,
      label,
      type: type || 'related'
    };
    
    session.edges.push(newEdge);
    await session.save();
    
    res.status(201).json({
      success: true,
      message: 'Edge added successfully',
      edge: newEdge
    });
  } catch (error) {
    console.error('Add edge error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add edge'
    });
  }
});

module.exports = router;
