const ChatHistoryEntry = require('../models/ChatHistoryEntry');
const Session = require('../models/Session');
const Evidence = require('../models/Evidence');
const nlpService = require('../services/nlpService');
const ApiResponse = require('../utils/apiResponse');
const TitleGenerator = require('../utils/titleGenerator');
const axios = require('axios');

class ChatController {
  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.visionModel = 'qwen/qwen2.5-vl-32b-instruct:free';
    
    // Cache for chat responses
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get chat history with auto-generated titles
   */
  async getChatHistory(req, res) {
    try {
      const userId = req.user?._id || req.query.userId || 'dev-user-123';
      
      console.log(`📚 Fetching chat history for user ${userId}`);

      // Get chat history entries
      const historyEntries = await ChatHistoryEntry.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50);

      // Group by session and generate titles
      const groupedHistory = this.groupHistoryBySession(historyEntries);
      
      const historyData = groupedHistory.map(group => ({
        id: group.sessionId,
        title: group.title,
        messages: group.messages,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        messageCount: group.messages.length
      }));

      return res.json(ApiResponse.success('Chat history retrieved successfully', historyData));

    } catch (error) {
      console.error('❌ Chat history error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to fetch chat history', error));
    }
  }

  /**
   * RAG-based chat response with image context
   */
  async chatWithRAG(req, res) {
    const startTime = Date.now();
    
    try {
      const { userId, message, imageId, sessionId, options = {} } = req.body;
      const actualUserId = userId || req.user?._id || 'dev-user-123';
      
      if (!message) {
        return res.status(400).json(ApiResponse.error('message is required'));
      }

      console.log(`💬 RAG Chat request from user ${actualUserId}: ${message.substring(0, 100)}...`);

      // Check cache first
      const cacheKey = this.generateCacheKey(actualUserId, message, imageId, sessionId);
      const cachedResponse = this.getFromCache(cacheKey);
      if (cachedResponse) {
        console.log('📋 Using cached chat response');
        return res.json(ApiResponse.success('Chat response generated (from cache)', {
          response: cachedResponse,
          processingTime: Date.now() - startTime,
          fromCache: true
        }));
      }

      // 1. Retrieve context from database
      const context = await this.retrieveContext(actualUserId, imageId, sessionId);
      
      // 2. Generate RAG-enhanced response
      let response = await this.generateRAGResponse(message, context, options);
      
      // Validate response has content
      if (!response || !response.content || response.content.trim() === '') {
        console.log('⚠️ RAG response is empty, using fallback');
        response = this.generateFallbackResponse(message, context);
      }
      
      // 3. Save chat history with auto-generated title (async)
      this.saveChatHistoryWithTitleAsync(actualUserId, sessionId, 'user', message, response.content);
      
      // 4. Cache the response
      this.setCache(cacheKey, response);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ RAG Chat response generated in ${processingTime}ms`);
    
      return res.json(ApiResponse.success('Chat response generated successfully', {
        response: response,
        processingTime,
        method: response.method || 'rag-enhanced'
      }));
    
    } catch (error) {
      console.error('❌ RAG Chat error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to generate chat response', error));
    }
  }

  /**
   * Retrieve context for RAG-based responses
   */
  async retrieveContext(userId, imageId, sessionId) {
    const context = {
      sessions: [],
      evidence: [],
      chatHistory: [],
      imageUrl: null
    };

    try {
      // Get recent sessions
      if (sessionId) {
        const session = await Session.findOne({ sessionId, userId });
        if (session) {
          context.sessions.push(session);
        }
      } else {
        // Get recent sessions for user
        const recentSessions = await Session.find({ userId })
          .sort({ createdAt: -1 })
          .limit(3);
        context.sessions.push(...recentSessions);
      }

      // Get evidence related to image
      if (imageId) {
        const evidence = await Evidence.find({ originalImageId: imageId });
        context.evidence.push(...evidence);
        
        // Get image URL from first evidence record
        if (evidence.length > 0) {
          context.imageUrl = evidence[0].imageUrl;
        }
      }

      // Get recent chat history
      const chatHistory = await ChatHistoryEntry.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10);
      context.chatHistory.push(...chatHistory);

      console.log(`📚 Retrieved context: ${context.sessions.length} sessions, ${context.evidence.length} evidence, ${context.chatHistory.length} chat entries`);
      
      return context;

  } catch (error) {
      console.error('Failed to retrieve context:', error);
      return context;
    }
  }

  /**
   * Generate RAG-enhanced response
   */
  async generateRAGResponse(message, context, options = {}) {
    try {
      // If we have image context, use vision model
      if (context.imageUrl && this.openRouterApiKey) {
        console.log('🖼️ Using vision model for RAG response');
        return await this.generateVisionRAGResponse(message, context, options);
      }
      
      // Otherwise use text-based RAG
      console.log('📝 Using text-based RAG response');
      return await this.generateTextRAGResponse(message, context, options);
      
  } catch (error) {
      console.error('RAG response generation failed:', error);
      return this.generateFallbackResponse(message, context);
    }
  }

  /**
   * Generate vision-based RAG response
   */
  async generateVisionRAGResponse(message, context, options = {}) {
    try {
      const prompt = this.buildVisionRAGPrompt(message, context);
      
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: context.imageUrl } }
          ]
        }
      ];

      const response = await axios.post(this.openRouterApiUrl, {
        model: this.visionModel,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app-domain.com',
          'X-Title': 'AI Study Helper'
        },
        timeout: 30000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;
        
        // Validate content is not empty
        if (!content || content.trim() === '') {
          console.log('⚠️ Vision model returned empty content, using fallback');
          return this.generateFallbackResponse(message, context);
        }
        
        return {
          content: content.trim(),
          method: 'vision-rag',
          model: this.visionModel,
          contextUsed: {
            sessions: context.sessions.length,
            evidence: context.evidence.length,
            chatHistory: context.chatHistory.length,
            hasImage: !!context.imageUrl
          }
        };
      }
      
      console.log('⚠️ Invalid response from vision model, using fallback');
      return this.generateFallbackResponse(message, context);
      
    } catch (error) {
      console.error('Vision RAG response failed:', error);
      console.log('🔄 Using fallback response due to error');
      return this.generateFallbackResponse(message, context);
    }
  }

  /**
   * Generate text-based RAG response
   */
  async generateTextRAGResponse(message, context, options = {}) {
    try {
      const prompt = this.buildTextRAGPrompt(message, context);
      
      const response = await axios.post(this.openRouterApiUrl, {
        model: 'meta-llama/llama-3.2-11b-instruct:free',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app-domain.com',
          'X-Title': 'AI Study Helper'
        },
        timeout: 30000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;
        
        // Validate content is not empty
        if (!content || content.trim() === '') {
          console.log('⚠️ Text model returned empty content, using fallback');
          return this.generateFallbackResponse(message, context);
        }
        
        return {
          content: content.trim(),
          method: 'text-rag',
          model: 'meta-llama/llama-3.2-11b-instruct:free',
          contextUsed: {
            sessions: context.sessions.length,
            evidence: context.evidence.length,
            chatHistory: context.chatHistory.length,
            hasImage: false
          }
        };
      }
      
      console.log('⚠️ Invalid response from text model, using fallback');
      return this.generateFallbackResponse(message, context);
      
  } catch (error) {
      console.error('Text RAG response failed:', error);
      console.log('🔄 Using fallback response due to error');
      return this.generateFallbackResponse(message, context);
    }
  }

  /**
   * Build vision RAG prompt
   */
  buildVisionRAGPrompt(message, context) {
    const sessionInfo = context.sessions.map(s => 
      `Session: ${s.title}\nConcepts: ${s.nodes.map(n => n.content).join(', ')}`
    ).join('\n\n');
    
    const evidenceInfo = context.evidence.map(ev => 
      `Evidence: ${ev.text} (confidence: ${ev.ocrConfidence})`
    ).join('\n');
    
    const chatHistory = context.chatHistory
      .filter(ch => ch.role === 'user')
      .slice(0, 3)
      .map(ch => `User: ${ch.text}`)
      .join('\n');

    return `You are an AI study assistant with access to educational content from images and previous conversations.

**CONTEXT FROM IMAGE:**
${evidenceInfo}

**PREVIOUS STUDY SESSIONS:**
${sessionInfo}

**RECENT CONVERSATION HISTORY:**
${chatHistory}

**CURRENT USER QUESTION:**
${message}

**INSTRUCTIONS:**
- Use the image content and context to provide accurate, helpful responses
- Reference specific concepts from the study sessions when relevant
- Be educational and supportive
- Keep responses concise but informative
- If the question is about the image content, analyze what you see carefully

**RESPONSE:**`;
  }

  /**
   * Build text RAG prompt
   */
  buildTextRAGPrompt(message, context) {
    const sessionInfo = context.sessions.map(s => 
      `Session: ${s.title}\nConcepts: ${s.nodes.map(n => n.content).join(', ')}`
    ).join('\n\n');
    
    const evidenceInfo = context.evidence.map(ev => 
      `Evidence: ${ev.text} (confidence: ${ev.ocrConfidence})`
    ).join('\n');
    
    const chatHistory = context.chatHistory
      .filter(ch => ch.role === 'user')
      .slice(0, 3)
      .map(ch => `User: ${ch.text}`)
      .join('\n');

    return `You are an AI study assistant with access to educational content and previous conversations.

**EXTRACTED CONTENT:**
${evidenceInfo}

**PREVIOUS STUDY SESSIONS:**
${sessionInfo}

**RECENT CONVERSATION HISTORY:**
${chatHistory}

**CURRENT USER QUESTION:**
${message}

**INSTRUCTIONS:**
- Use the extracted content and context to provide accurate, helpful responses
- Reference specific concepts from the study sessions when relevant
- Be educational and supportive
- Keep responses concise but informative

**RESPONSE:**`;
  }

  /**
   * Generate fallback response
   */
  generateFallbackResponse(message, context) {
    const hasContext = context.sessions.length > 0 || context.evidence.length > 0;
    
    if (hasContext) {
      return {
        content: `I can see you have some study content available. Based on the context, I'd be happy to help you with "${message}". Could you please provide more specific details about what you'd like to know?`,
        method: 'fallback-with-context',
        contextUsed: {
          sessions: context.sessions.length,
          evidence: context.evidence.length,
          chatHistory: context.chatHistory.length,
          hasImage: !!context.imageUrl
        }
      };
    } else {
      return {
        content: `I'd be happy to help you with "${message}"! To provide the best assistance, please upload an image of your study materials so I can analyze the content and give you more specific, contextual help.`,
        method: 'fallback-no-context',
        contextUsed: {
          sessions: 0,
          evidence: 0,
          chatHistory: 0,
          hasImage: false
        }
      };
    }
  }

  /**
   * Save chat history asynchronously
   */
  async saveChatHistoryAsync(userId, sessionId, role, text) {
    try {
      const chatEntry = new ChatHistoryEntry({
        userId,
        sessionId,
        role,
        text,
        messageType: role === 'assistant' ? 'rag_response' : 'user_question'
      });
      
      await chatEntry.save();
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }

  /**
   * Save chat history with auto-generated title asynchronously
   */
  async saveChatHistoryWithTitleAsync(userId, sessionId, role, userMessage, assistantResponse) {
    try {
      // Validate inputs before saving
      if (!userMessage || userMessage.trim() === '') {
        console.log('⚠️ Skipping user message save - empty message');
        return;
      }

      if (!assistantResponse || assistantResponse.trim() === '') {
        console.log('⚠️ Skipping assistant response save - empty response');
        return;
      }

      // Save user message
      await ChatHistoryEntry.create({
        userId,
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        text: userMessage.trim(), // Use 'text' field as required by model
        timestamp: new Date()
      });

      // Save assistant response
      await ChatHistoryEntry.create({
        userId,
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        text: assistantResponse.trim(), // Use 'text' field as required by model
        timestamp: new Date()
      });

      console.log('💾 Chat history saved with auto-generated title');
    } catch (error) {
      console.error('❌ Error saving chat history:', error);
    }
  }

  /**
   * Clear chat history
   */
  async clearChatHistory(req, res) {
    try {
      const { userId, sessionId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const query = { userId };
      if (sessionId) {
        query.sessionId = sessionId;
      }

      const result = await ChatHistoryEntry.deleteMany(query);
    
    res.status(200).json({
      success: true,
        message: `Cleared ${result.deletedCount} chat entries`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat history'
    });
  }
  }

  /**
   * Cache management
   */
  generateCacheKey(userId, message, imageId, sessionId) {
    const key = `${userId}_${message.substring(0, 100)}_${imageId || 'noimage'}_${sessionId || 'nosession'}`;
    let hash = 0;
    
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString();
  }

  getFromCache(key) {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.responseCache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.responseCache.size > 100) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }
  }

  // Helper methods
  groupHistoryBySession(historyEntries) {
    const grouped = {};
    
    historyEntries.forEach(entry => {
      const sessionId = entry.sessionId || 'default-session';
      
      if (!grouped[sessionId]) {
        grouped[sessionId] = {
          sessionId,
          messages: [],
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        };
      }
      
      grouped[sessionId].messages.push({
        role: entry.role,
        content: entry.content,
        timestamp: entry.createdAt
      });
      
      // Update the latest timestamp
      if (entry.updatedAt > grouped[sessionId].updatedAt) {
        grouped[sessionId].updatedAt = entry.updatedAt;
      }
    });

    // Generate titles for each session
    return Object.values(grouped).map(group => ({
      ...group,
      title: TitleGenerator.generateChatTitle(
        group.messages[0]?.content || '',
        group.messages.length > 0 ? 'chat' : 'chat'
      )
    }));
  }
}

module.exports = new ChatController();
