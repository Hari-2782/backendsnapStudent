const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Evidence = require('../models/Evidence');
const ChatHistoryEntry = require('../models/ChatHistoryEntry');
const { generateEmbeddings, findSimilarContent, calculateCosineSimilarity } = require('../services/embedService');

/**
 * Semantic search across all user content
 * @route GET /api/search/semantic
 * @access Private
 */
const semanticSearch = async (req, res) => {
  try {
    const { q, type, limit = 10, threshold = 0.7 } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    // Generate embeddings for search query
    const queryEmbedding = await generateEmbeddings(q.trim());
    
    if (!queryEmbedding) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process search query'
      });
    }
    
    // Search across different content types
    const searchResults = [];
    
    // Search sessions
    if (!type || type === 'session') {
      const sessions = await Session.find({ userId: req.user._id });
      for (const session of sessions) {
        const sessionText = `${session.title} ${session.description} ${session.nodes.map(n => n.content).join(' ')}`;
        const sessionEmbedding = await generateEmbeddings(sessionText);
        
        if (sessionEmbedding) {
          const similarity = calculateCosineSimilarity(queryEmbedding, sessionEmbedding);
          if (similarity >= threshold) {
            searchResults.push({
              type: 'session',
              id: session.sessionId,
              title: session.title,
              description: session.description,
              similarity,
              content: sessionText.substring(0, 200),
              metadata: {
                nodeCount: session.nodes.length,
                tags: session.tags,
                createdAt: session.createdAt
              }
            });
          }
        }
      }
    }
    
    // Search quizzes
    if (!type || type === 'quiz') {
      const quizzes = await Quiz.find({ userId: req.user._id });
      for (const quiz of quizzes) {
        const quizText = `${quiz.title} ${quiz.description} ${quiz.questions.map(q => q.question).join(' ')}`;
        const quizEmbedding = await generateEmbeddings(quizText);
        
        if (quizEmbedding) {
          const similarity = calculateCosineSimilarity(queryEmbedding, quizEmbedding);
          if (similarity >= threshold) {
            searchResults.push({
              type: 'quiz',
              id: quiz.quizId,
              title: quiz.title,
              description: quiz.description,
              similarity,
              content: quizText.substring(0, 200),
              metadata: {
                questionCount: quiz.questions.length,
                tags: quiz.tags,
                createdAt: quiz.createdAt
              }
            });
          }
        }
      }
    }
    
    // Search evidence
    if (!type || type === 'evidence') {
      const evidence = await Evidence.find({ userId: req.user._id });
      for (const ev of evidence) {
        const evidenceText = ev.text;
        const evidenceEmbedding = await generateEmbeddings(evidenceText);
        
        if (evidenceEmbedding) {
          const similarity = calculateCosineSimilarity(queryEmbedding, evidenceEmbedding);
          if (similarity >= threshold) {
            searchResults.push({
              type: 'evidence',
              id: ev._id,
              title: `Evidence: ${ev.contentType}`,
              description: evidenceText.substring(0, 100),
              similarity,
              content: evidenceText.substring(0, 200),
              metadata: {
                contentType: ev.contentType,
                ocrConfidence: ev.ocrConfidence,
                createdAt: ev.createdAt
              }
            });
          }
        }
      }
    }
    
    // Search chat history
    if (!type || type === 'chat') {
      const chatEntries = await ChatHistoryEntry.find({ userId: req.user._id });
      for (const entry of chatEntries) {
        const chatText = entry.text;
        const chatEmbedding = await generateEmbeddings(chatText);
        
        if (chatEmbedding) {
          const similarity = calculateCosineSimilarity(queryEmbedding, chatEmbedding);
          if (similarity >= threshold) {
            searchResults.push({
              type: 'chat',
              id: entry._id,
              title: `Chat: ${entry.messageType}`,
              description: chatText.substring(0, 100),
              similarity,
              content: chatText.substring(0, 200),
              metadata: {
                messageType: entry.messageType,
                role: entry.role,
                createdAt: entry.createdAt
              }
            });
          }
        }
      }
    }
    
    // Sort by similarity and limit results
    searchResults.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = searchResults.slice(0, limit);
    
    res.status(200).json({
      success: true,
      query: q.trim(),
      results: limitedResults,
      totalResults: searchResults.length,
      searchType: type || 'all',
      threshold
    });
    
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform semantic search'
    });
  }
};

/**
 * Text-based search across content
 * @route GET /api/search/text
 * @access Private
 */
const textSearch = async (req, res) => {
  try {
    const { q, type, page = 1, limit = 20 } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const searchQuery = q.trim();
    const searchResults = [];
    
    // Search sessions
    if (!type || type === 'session') {
      const sessions = await Session.find({
        userId: req.user._id,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } }
        ]
      }).limit(limit);
      
      sessions.forEach(session => {
        searchResults.push({
          type: 'session',
          id: session.sessionId,
          title: session.title,
          description: session.description,
          matchType: 'text',
          metadata: {
            nodeCount: session.nodes.length,
            tags: session.tags,
            createdAt: session.createdAt
          }
        });
      });
    }
    
    // Search quizzes
    if (!type || type === 'quiz') {
      const quizzes = await Quiz.find({
        userId: req.user._id,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } }
        ]
      }).limit(limit);
      
      quizzes.forEach(quiz => {
        searchResults.push({
          type: 'quiz',
          id: quiz.quizId,
          title: quiz.title,
          description: quiz.description,
          matchType: 'text',
          metadata: {
            questionCount: quiz.questions.length,
            tags: quiz.tags,
            createdAt: quiz.createdAt
          }
        });
      });
    }
    
    // Search evidence
    if (!type || type === 'evidence') {
      const evidence = await Evidence.find({
        userId: req.user._id,
        $or: [
          { text: { $regex: searchQuery, $options: 'i' } },
          { contentType: { $regex: searchQuery, $options: 'i' } }
        ]
      }).limit(limit);
      
      evidence.forEach(ev => {
        searchResults.push({
          type: 'evidence',
          id: ev._id,
          title: `Evidence: ${ev.contentType}`,
          description: ev.text.substring(0, 100),
          matchType: 'text',
          metadata: {
            contentType: ev.contentType,
            ocrConfidence: ev.ocrConfidence,
            createdAt: ev.createdAt
          }
        });
      });
    }
    
    // Search chat history
    if (!type || type === 'chat') {
      const chatEntries = await ChatHistoryEntry.find({
        userId: req.user._id,
        text: { $regex: searchQuery, $options: 'i' }
      }).limit(limit);
      
      chatEntries.forEach(entry => {
        searchResults.push({
          type: 'chat',
          id: entry._id,
          title: `Chat: ${entry.messageType}`,
          description: entry.text.substring(0, 100),
          matchType: 'text',
          metadata: {
            messageType: entry.messageType,
            role: entry.role,
            createdAt: entry.createdAt
          }
        });
      });
    }
    
    // Sort by creation date and apply pagination
    searchResults.sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = searchResults.slice(startIndex, endIndex);
    
    res.status(200).json({
      success: true,
      query: searchQuery,
      results: paginatedResults,
      totalResults: searchResults.length,
      searchType: type || 'all',
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(searchResults.length / limit),
        hasNext: endIndex < searchResults.length,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Text search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform text search'
    });
  }
};

/**
 * Advanced search with filters
 * @route POST /api/search/advanced
 * @access Private
 */
const advancedSearch = async (req, res) => {
  try {
    const { 
      query, 
      types = [], 
      dateRange, 
      tags = [], 
      confidence = 0,
      limit = 20 
    } = req.body;
    
    if (!query && types.length === 0 && tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one search criteria is required'
      });
    }
    
    const searchResults = [];
    
    // Build date filter
    let dateFilter = {};
    if (dateRange && dateRange.start && dateRange.end) {
      dateFilter = {
        createdAt: {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        }
      };
    }
    
    // Search sessions
    if (types.includes('session') || types.length === 0) {
      const sessionFilter = {
        userId: req.user._id,
        ...dateFilter
      };
      
      if (query) {
        sessionFilter.$or = [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ];
      }
      
      if (tags.length > 0) {
        sessionFilter.tags = { $in: tags };
      }
      
      const sessions = await Session.find(sessionFilter).limit(limit);
      sessions.forEach(session => {
        searchResults.push({
          type: 'session',
          id: session.sessionId,
          title: session.title,
          description: session.description,
          matchType: 'advanced',
          metadata: {
            nodeCount: session.nodes.length,
            tags: session.tags,
            createdAt: session.createdAt
          }
        });
      });
    }
    
    // Search evidence with confidence filter
    if (types.includes('evidence') || types.length === 0) {
      const evidenceFilter = {
        userId: req.user._id,
        ...dateFilter
      };
      
      if (query) {
        evidenceFilter.text = { $regex: query, $options: 'i' };
      }
      
      if (confidence > 0) {
        evidenceFilter.ocrConfidence = { $gte: confidence };
      }
      
      if (tags.length > 0) {
        evidenceFilter.contentType = { $in: tags };
      }
      
      const evidence = await Evidence.find(evidenceFilter).limit(limit);
      evidence.forEach(ev => {
        searchResults.push({
          type: 'evidence',
          id: ev._id,
          title: `Evidence: ${ev.contentType}`,
          description: ev.text.substring(0, 100),
          matchType: 'advanced',
          metadata: {
            contentType: ev.contentType,
            ocrConfidence: ev.ocrConfidence,
            createdAt: ev.createdAt
          }
        });
      });
    }
    
    // Sort by creation date
    searchResults.sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));
    
    res.status(200).json({
      success: true,
      query: query || '',
      results: searchResults,
      totalResults: searchResults.length,
      filters: {
        types,
        dateRange,
        tags,
        confidence
      }
    });
    
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform advanced search'
    });
  }
};

/**
 * Get search suggestions
 * @route GET /api/search/suggestions
 * @access Private
 */
const getSearchSuggestions = async (req, res) => {
  try {
    const { q, type } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        suggestions: []
      });
    }
    
    const suggestions = [];
    const query = q.toLowerCase();
    
    // Get suggestions from sessions
    if (!type || type === 'session') {
      const sessions = await Session.find({
        userId: req.user._id,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }).limit(5);
      
      sessions.forEach(session => {
        suggestions.push({
          type: 'session',
          text: session.title,
          id: session.sessionId
        });
        
        session.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query) && !suggestions.find(s => s.text === tag)) {
            suggestions.push({
              type: 'tag',
              text: tag,
              id: `tag_${tag}`
            });
          }
        });
      });
    }
    
    // Get suggestions from evidence content types
    if (!type || type === 'evidence') {
      const evidenceTypes = await Evidence.distinct('contentType', {
        userId: req.user._id,
        contentType: { $regex: query, $options: 'i' }
      });
      
      evidenceTypes.slice(0, 3).forEach(contentType => {
        suggestions.push({
          type: 'contentType',
          text: contentType,
          id: `contentType_${contentType}`
        });
      });
    }
    
    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.text === suggestion.text)
    ).slice(0, 10);
    
    res.status(200).json({
      success: true,
      query: q,
      suggestions: uniqueSuggestions
    });
    
  } catch (error) {
    console.error('Get search suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions'
    });
  }
};

module.exports = {
  semanticSearch,
  textSearch,
  advancedSearch,
  getSearchSuggestions
};
