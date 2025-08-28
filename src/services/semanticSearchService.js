const axios = require('axios');
const { Embedding } = require('../models/Embedding');
const { Session } = require('../models/Session');
const { Quiz } = require('../models/Quiz');
const { MindMap } = require('../models/MindMap');

class SemanticSearchService {
  constructor() {
    this.hfApiKey = process.env.HF_API_KEY;
    this.hfApiUrl = 'https://api-inference.huggingface.co/models';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
    this.vectorDimension = parseInt(process.env.VECTOR_DIMENSION) || 384;
    this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7;
    
    console.log('🔍 Semantic Search Service initialized:', {
      hasHfApiKey: !!this.hfApiKey,
      embeddingModel: this.embeddingModel,
      vectorDimension: this.vectorDimension,
      similarityThreshold: this.similarityThreshold
    });
  }

  /**
   * Generate embeddings for text using Hugging Face
   */
  async generateEmbeddings(text) {
    try {
      if (!this.hfApiKey) {
        throw new Error('Hugging Face API key not configured');
      }

      const response = await axios.post(
        `${this.hfApiUrl}/${this.embeddingModel}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${this.hfApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && Array.isArray(response.data)) {
        return response.data[0];
      }

      throw new Error('Invalid response format from Hugging Face API');

    } catch (error) {
      console.error('Failed to generate embeddings:', error.message);
      throw error;
    }
  }

  /**
   * Search for similar content using vector similarity
   */
  async searchSimilarContent(query, userId, options = {}) {
    try {
      console.log('🔍 Searching for similar content:', { query: query.substring(0, 100), userId });

      // Generate embeddings for the query
      const queryEmbeddings = await this.generateEmbeddings(query);

      // Search in different content types
      const searchResults = await Promise.all([
        this.searchSessions(queryEmbeddings, userId, options),
        this.searchQuizzes(queryEmbeddings, userId, options),
        this.searchMindMaps(queryEmbeddings, userId, options)
      ]);

      // Combine and rank results
      const allResults = searchResults.flat();
      const rankedResults = this.rankResults(allResults, query);

      console.log(`✅ Found ${rankedResults.length} relevant results`);
      return rankedResults;

    } catch (error) {
      console.error('Semantic search failed:', error.message);
      return [];
    }
  }

  /**
   * Search sessions using vector similarity
   */
  async searchSessions(queryEmbeddings, userId, options) {
    try {
      // Get all sessions for the user
      const sessions = await Session.find({ userId }).populate('nodes');
      
      const results = [];
      for (const session of sessions) {
        // Calculate similarity for session title and content
        const titleSimilarity = this.calculateCosineSimilarity(
          queryEmbeddings, 
          session.title
        );
        
        const contentSimilarity = this.calculateCosineSimilarity(
          queryEmbeddings,
          session.nodes.map(n => n.content).join(' ')
        );

        const maxSimilarity = Math.max(titleSimilarity, contentSimilarity);
        
        if (maxSimilarity >= this.similarityThreshold) {
          results.push({
            type: 'session',
            id: session.sessionId,
            title: session.title,
            content: session.nodes.map(n => n.content).join(' '),
            similarity: maxSimilarity,
            metadata: {
              nodeCount: session.nodes.length,
              createdAt: session.createdAt,
              subject: session.metadata?.subject,
              difficulty: session.metadata?.difficulty
            }
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Session search failed:', error.message);
      return [];
    }
  }

  /**
   * Search quizzes using vector similarity
   */
  async searchQuizzes(queryEmbeddings, userId, options) {
    try {
      const quizzes = await Quiz.find({ userId });
      
      const results = [];
      for (const quiz of quizzes) {
        const titleSimilarity = this.calculateCosineSimilarity(
          queryEmbeddings,
          quiz.title
        );
        
        const topicSimilarity = this.calculateCosineSimilarity(
          queryEmbeddings,
          quiz.topic
        );

        const maxSimilarity = Math.max(titleSimilarity, topicSimilarity);
        
        if (maxSimilarity >= this.similarityThreshold) {
          results.push({
            type: 'quiz',
            id: quiz.quizId,
            title: quiz.title,
            topic: quiz.topic,
            similarity: maxSimilarity,
            metadata: {
              questionCount: quiz.totalQuestions,
              difficulty: quiz.difficulty,
              subject: quiz.subject,
              createdAt: quiz.createdAt
            }
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Quiz search failed:', error.message);
      return [];
    }
  }

  /**
   * Search mind maps using vector similarity
   */
  async searchMindMaps(queryEmbeddings, userId, options) {
    try {
      const mindMaps = await MindMap.find({ userId });
      
      const results = [];
      for (const mindMap of mindMaps) {
        const titleSimilarity = this.calculateCosineSimilarity(
          queryEmbeddings,
          mindMap.title
        );
        
        const topicSimilarity = this.calculateCosineSimilarity(
          queryEmbeddings,
          mindMap.topic
        );

        const maxSimilarity = Math.max(titleSimilarity, topicSimilarity);
        
        if (maxSimilarity >= this.similarityThreshold) {
          results.push({
            type: 'mindmap',
            id: mindMap.mindMapId,
            title: mindMap.title,
            topic: mindMap.topic,
            similarity: maxSimilarity,
            metadata: {
              nodeCount: mindMap.statistics.totalNodes,
              subject: mindMap.subject,
              complexity: mindMap.statistics.complexity,
              createdAt: mindMap.createdAt
            }
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Mind map search failed:', error.message);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateCosineSimilarity(vectorA, textB) {
    try {
      // For now, using a simple text similarity
      // In production, you'd want to compare actual vector embeddings
      const wordsA = vectorA.toLowerCase().split(/\s+/);
      const wordsB = textB.toLowerCase().split(/\s+/);
      
      const intersection = wordsA.filter(word => wordsB.includes(word));
      const union = [...new Set([...wordsA, ...wordsB])];
      
      return intersection.length / union.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Rank search results by relevance
   */
  rankResults(results, query) {
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10); // Return top 10 results
  }

  /**
   * Generate context-aware response using RAG
   */
  async generateContextualResponse(userQuery, userId, options = {}) {
    try {
      console.log('🧠 Generating contextual response for:', userQuery.substring(0, 100));

      // Search for relevant content
      const relevantContent = await this.searchSimilarContent(userQuery, userId, options);
      
      if (relevantContent.length === 0) {
        return {
          response: "I don't have enough context to provide a specific answer. Try asking a more general question or upload some study materials first.",
          confidence: 0.3,
          sources: [],
          suggestions: [
            "Upload an image or document to get started",
            "Ask about general study topics",
            "Create a new study session"
          ]
        };
      }

      // Build context from relevant content
      const context = this.buildContext(relevantContent);
      
      // Generate response using the context
      const response = await this.generateResponseWithContext(userQuery, context, options);

      return {
        response: response,
        confidence: this.calculateResponseConfidence(relevantContent),
        sources: relevantContent.map(item => ({
          type: item.type,
          id: item.id,
          title: item.title,
          relevance: item.similarity
        })),
        suggestions: this.generateSuggestions(relevantContent, userQuery)
      };

    } catch (error) {
      console.error('Contextual response generation failed:', error.message);
      return {
        response: "I'm having trouble processing your request right now. Please try again later.",
        confidence: 0.2,
        sources: [],
        suggestions: ["Check your internet connection", "Try a different question", "Contact support if the issue persists"]
      };
    }
  }

  /**
   * Build context from relevant content
   */
  buildContext(relevantContent) {
    let context = '';
    
    relevantContent.forEach((item, index) => {
      context += `\n\n--- ${item.type.toUpperCase()} ${index + 1} ---\n`;
      context += `Title: ${item.title}\n`;
      if (item.content) {
        context += `Content: ${item.content.substring(0, 500)}...\n`;
      }
      if (item.topic) {
        context += `Topic: ${item.topic}\n`;
      }
      context += `Relevance: ${(item.similarity * 100).toFixed(1)}%\n`;
    });

    return context;
  }

  /**
   * Generate response using context and user query
   */
  async generateResponseWithContext(userQuery, context, options) {
    try {
      if (!this.hfApiKey) {
        // Fallback to simple response generation
        return this.generateSimpleResponse(userQuery, context);
      }

      const prompt = `Based on the following context, provide a helpful and accurate answer to the user's question.

Context:${context}

User Question: ${userQuery}

Please provide a comprehensive answer that:
1. Directly addresses the user's question
2. References relevant information from the context
3. Is educational and helpful
4. Suggests related topics or next steps if appropriate

Answer:`;

      // Use Hugging Face for response generation
      const response = await axios.post(
        `${this.hfApiUrl}/google/flan-t5-large`,
        { inputs: prompt },
        {
          headers: {
            'Authorization': `Bearer ${this.hfApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data[0] && response.data[0].generated_text) {
        return response.data[0].generated_text;
      }

      throw new Error('Invalid response from Hugging Face API');

    } catch (error) {
      console.error('AI response generation failed, using fallback:', error.message);
      return this.generateSimpleResponse(userQuery, context);
    }
  }

  /**
   * Generate simple response when AI is not available
   */
  generateSimpleResponse(userQuery, context) {
    const queryLower = userQuery.toLowerCase();
    
    if (queryLower.includes('what') || queryLower.includes('explain')) {
      return `Based on your study materials, I can help explain concepts related to your question. The context shows relevant information that might be helpful. Would you like me to break down any specific part of this topic?`;
    } else if (queryLower.includes('how') || queryLower.includes('method')) {
      return `I found some relevant study materials that might help with your question about methods or processes. The context contains information that could guide you through the steps.`;
    } else if (queryLower.includes('when') || queryLower.includes('time')) {
      return `Your study materials contain information that might be relevant to your timing question. I can help you understand the chronological aspects of this topic.`;
    } else {
      return `I found some relevant study materials that might help answer your question. The context contains information that could be useful. Would you like me to explain any specific aspect in more detail?`;
    }
  }

  /**
   * Calculate response confidence based on source relevance
   */
  calculateResponseConfidence(relevantContent) {
    if (relevantContent.length === 0) return 0.2;
    
    const avgRelevance = relevantContent.reduce((sum, item) => sum + item.similarity, 0) / relevantContent.length;
    const sourceCount = Math.min(relevantContent.length / 5, 1); // Normalize source count
    
    return Math.min(0.9, avgRelevance * 0.7 + sourceCount * 0.2);
  }

  /**
   * Generate helpful suggestions based on context
   */
  generateSuggestions(relevantContent, userQuery) {
    const suggestions = [];
    
    if (relevantContent.length > 0) {
      suggestions.push("Review the related study materials I found");
      suggestions.push("Ask follow-up questions about specific concepts");
    }
    
    if (userQuery.toLowerCase().includes('quiz') || userQuery.toLowerCase().includes('test')) {
      suggestions.push("Take a practice quiz on this topic");
      suggestions.push("Create flashcards for key concepts");
    }
    
    if (userQuery.toLowerCase().includes('diagram') || userQuery.toLowerCase().includes('visual')) {
      suggestions.push("Create a mind map to visualize the concepts");
      suggestions.push("Draw diagrams to reinforce understanding");
    }
    
    suggestions.push("Schedule regular review sessions");
    suggestions.push("Connect this topic to related subjects");
    
    return suggestions.slice(0, 4); // Return top 4 suggestions
  }

  /**
   * Learn user preferences from interactions
   */
  async learnUserPreferences(userId, query, response, feedback) {
    try {
      // Store user interaction for preference learning
      // This could be expanded to include more sophisticated preference modeling
      console.log('📚 Learning user preferences:', { userId, query: query.substring(0, 50), feedback });
      
      // TODO: Implement preference learning algorithm
      // - Track successful query-response pairs
      // - Learn preferred content types and topics
      // - Adapt search parameters based on user behavior
      
    } catch (error) {
      console.error('Failed to learn user preferences:', error.message);
    }
  }
}

module.exports = new SemanticSearchService();
