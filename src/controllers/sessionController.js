const Session = require('../models/Session');
const ChatHistoryEntry = require('../models/ChatHistoryEntry');
const nlpService = require('../services/nlpService');
const ApiResponse = require('../utils/apiResponse');

class SessionController {
  /**
   * Create a new session with enhanced title generation
   */
  async createSession(req, res) {
    try {
      const { title, description, imageId, initialContent, tags = [] } = req.body;
      const userId = req.user?._id || 'dev-user-123';

      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Generate meaningful title based on content
      let generatedTitle = title;
      if (!title || title.includes('Study Session from Image')) {
        generatedTitle = await this.generateDescriptiveTitle(initialContent, imageId);
      }

      // Create session
      const session = new Session({
        sessionId,
        userId,
        title: generatedTitle,
        description: description || `Study session created from ${imageId ? 'uploaded image' : 'content'}`,
        tags: [...tags, 'auto-generated'],
        source: {
          uploadFilename: imageId,
          imageUrl: imageId ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${imageId}` : null
        },
        status: 'active'
      });

      await session.save();

      return res.status(201).json(ApiResponse.success('Session created successfully', {
        sessionId: session.sessionId,
        title: session.title,
        description: session.description,
        tags: session.tags,
        createdAt: session.createdAt
      }));

    } catch (error) {
      console.error('❌ Create session error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to create session', error));
    }
  }

  /**
   * Add chat message to session
   */
  async addChatMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { role, text, messageType = 'text', metadata = {} } = req.body;
      const userId = req.user?._id || 'dev-user-123';

      // Validate session exists
      const session = await Session.findOne({ sessionId, userId });
      if (!session) {
        return res.status(404).json(ApiResponse.notFound('Session not found'));
      }

      // Add to session chat array
      const chatMessage = {
        role,
        text,
        createdAt: new Date(),
        messageType,
        metadata
      };

      session.chat.push(chatMessage);
      await session.save();

      // Also log to ChatHistoryEntry for consistency
      await this.logChatHistoryAsync(userId, sessionId, role, text, messageType, metadata);

      // Update session title if it's a generic one and we have meaningful content
      if (session.title.includes('Study Session from Image') && role === 'assistant') {
        const newTitle = await this.generateDescriptiveTitle(text, session.source?.uploadFilename);
        if (newTitle && newTitle !== session.title) {
          session.title = newTitle;
          await session.save();
        }
      }

      return res.json(ApiResponse.success('Chat message added successfully', {
        messageId: chatMessage._id,
        sessionId,
        role,
        text: chatMessage.text,
        createdAt: chatMessage.createdAt
      }));

    } catch (error) {
      console.error('❌ Add chat message error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to add chat message', error));
    }
  }

  /**
   * Get session with full chat history
   */
  async getSessionWithChat(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user?._id || 'dev-user-123';

      const session = await Session.findOne({ sessionId, userId });
      if (!session) {
        return res.status(404).json(ApiResponse.notFound('Session not found'));
      }

      // Get chat history from both sources
      const sessionChat = session.chat || [];
      const historyChat = await ChatHistoryEntry.find({ 
        userId, 
        sessionId 
      }).sort({ createdAt: 1 });

      // Merge and deduplicate chat messages
      const allChat = this.mergeChatHistory(sessionChat, historyChat);

      return res.json(ApiResponse.success('Session retrieved successfully', {
        session: {
          sessionId: session.sessionId,
          title: session.title,
          description: session.description,
          tags: session.tags,
          type: session.nodes?.length > 0 ? 'mindmap' : 'chat',
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        },
        chat: allChat
      }));

    } catch (error) {
      console.error('❌ Get session error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to get session', error));
    }
  }

  /**
   * Update session title and description
   */
  async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { title, description, tags } = req.body;
      const userId = req.user?._id || 'dev-user-123';

      const session = await Session.findOne({ sessionId, userId });
      if (!session) {
        return res.status(404).json(ApiResponse.notFound('Session not found'));
      }

      // Update fields
      if (title) session.title = title;
      if (description) session.description = description;
      if (tags) session.tags = tags;

      await session.save();

      return res.json(ApiResponse.success('Session updated successfully', {
        sessionId: session.sessionId,
        title: session.title,
        description: session.description,
        tags: session.tags,
        updatedAt: session.updatedAt
      }));

    } catch (error) {
      console.error('❌ Update session error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to update session', error));
    }
  }

  /**
   * Generate descriptive title based on content
   */
  async generateDescriptiveTitle(content, imageId = null) {
    try {
      if (!content || content.length < 10) {
        return imageId ? `Study Session from ${imageId}` : 'New Study Session';
      }

      // Extract key topics from content
      const topics = await this.extractTopicsFromContent(content);
      
      if (topics.length > 0) {
        const mainTopic = topics[0];
        const topicName = mainTopic.name || mainTopic;
        
        // Create descriptive title
        if (content.includes('question') || content.includes('?')) {
          return `${topicName} Questions & Solutions`;
        } else if (content.includes('formula') || content.includes('equation')) {
          return `${topicName} Formulas & Equations`;
        } else if (content.includes('definition') || content.includes('concept')) {
          return `${topicName} Concepts & Definitions`;
        } else {
          return `${topicName} Study Session`;
        }
      }

      // Fallback based on content length and type
      if (content.length > 100) {
        const firstSentence = content.split('.')[0];
        return `${firstSentence.substring(0, 40)}...`;
      }

      return imageId ? `Study Session from ${imageId}` : 'New Study Session';

    } catch (error) {
      console.error('❌ Title generation error:', error);
      return imageId ? `Study Session from ${imageId}` : 'New Study Session';
    }
  }

  /**
   * Extract topics from content using NLP
   */
  async extractTopicsFromContent(content) {
    try {
      // Use NLP service to extract key concepts
      const concepts = await nlpService.extractKeyConcepts(content);
      
      if (concepts && concepts.length > 0) {
        return concepts.slice(0, 3); // Return top 3 concepts
      }

      // Fallback: simple keyword extraction
      const keywords = this.extractKeywords(content);
      return keywords.slice(0, 3);

    } catch (error) {
      console.error('❌ Topic extraction error:', error);
      return [];
    }
  }

  /**
   * Simple keyword extraction fallback
   */
  extractKeywords(text) {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
    
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Merge chat history from multiple sources
   */
  mergeChatHistory(sessionChat, historyChat) {
    const merged = [...sessionChat];
    
    // Add history entries that aren't already in session chat
    historyChat.forEach(historyEntry => {
      const exists = merged.some(chat => 
        chat.role === historyEntry.role && 
        chat.text === historyEntry.text &&
        Math.abs(new Date(chat.createdAt) - new Date(historyEntry.createdAt)) < 1000 // Within 1 second
      );
      
      if (!exists) {
        merged.push({
          role: historyEntry.role,
          text: historyEntry.text,
          createdAt: historyEntry.createdAt,
          messageType: historyEntry.messageType || 'text',
          metadata: historyEntry.metadata || {}
        });
      }
    });
    
    // Sort by creation time
    return merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  /**
   * Async chat history logging
   */
  async logChatHistoryAsync(userId, sessionId, role, text, messageType = 'text', metadata = {}) {
    try {
      const chatEntry = new ChatHistoryEntry({
        userId,
        sessionId,
        role,
        text,
        messageType,
        metadata
      });
      
      await chatEntry.save();
    } catch (error) {
      console.error('Failed to log chat history:', error);
    }
  }

  /**
   * Get all sessions with enhanced information
   */
  async getAllSessions(req, res) {
    try {
      const userId = req.user?._id || 'dev-user-123';
      const sessions = await Session.find({ userId }).sort({ createdAt: -1 });
      
      const enhancedSessions = sessions.map(session => {
        const title = session.computeDisplayTitle ? session.computeDisplayTitle() : session.title;
        const preview = this.generatePreview(session);
        const type = session.nodes?.length > 0 ? 'mindmap' : 'chat';
        const liked = session.likedBy?.some(id => id.toString() === userId.toString()) || false;
        
        return {
          sessionId: session.sessionId,
          title,
          description: session.description,
          preview,
          type,
          tags: session.tags || [],
          likes: session.likes || 0,
          liked,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          chatCount: session.chat?.length || 0,
          nodeCount: session.nodes?.length || 0
        };
      });

      return res.json(ApiResponse.success('Sessions retrieved successfully', {
        sessions: enhancedSessions
      }));

    } catch (error) {
      console.error('❌ Get sessions error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to get sessions', error));
    }
  }

  /**
   * Generate preview text for session
   */
  generatePreview(session) {
    // Try to get preview from chat messages
    if (session.chat && session.chat.length > 0) {
      const lastAssistantMessage = session.chat
        .filter(msg => msg.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage) {
        return lastAssistantMessage.text.substring(0, 100) + '...';
      }
      
      const lastMessage = session.chat[session.chat.length - 1];
      return lastMessage.text.substring(0, 100) + '...';
    }
    
    // Fallback to description or node content
    if (session.description) {
      return session.description;
    }
    
    if (session.nodes && session.nodes.length > 0) {
      return session.nodes[0].content.substring(0, 100) + '...';
    }
    
    return 'Study session';
  }
}

module.exports = new SessionController();
