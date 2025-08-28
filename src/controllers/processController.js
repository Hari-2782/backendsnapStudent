const ocrService = require('../services/ocrService');
const nlpService = require('../services/nlpService');
const embedService = require('../services/embedService');
const evidenceService = require('../services/evidenceService');
const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Evidence = require('../models/Evidence');
const ChatHistoryEntry = require('../models/ChatHistoryEntry');
const ApiResponse = require('../utils/apiResponse');
const TitleGenerator = require('../utils/titleGenerator');
const axios = require('axios');

class ProcessController {
  /**
   * Image upload and processing endpoint
   * Only stores summary, doesn't generate mind map immediately
   */
  async processImage(req, res) {
    const startTime = Date.now();
    
    try {
      const { imageId, userId, options = {} } = req.body;
      const actualUserId = userId || req.user?._id || 'dev-user-123';
      
      if (!imageId) {
        return res.status(400).json(ApiResponse.error('imageId is required'));
      }

      console.log(`🚀 Starting image processing for user ${actualUserId}, image ${imageId}`);
      
      // 1. Get image buffer
      const imageBuffer = await this.getImageBuffer(imageId);
      if (!imageBuffer) {
        return res.status(404).json(ApiResponse.notFound('Image not found'));
      }

      // 2. Run OCR pipeline
      console.log('📸 Running OCR pipeline...');
      const ocrResult = await ocrService.processImageOptimized(imageBuffer, {
        originalImageId: imageId,
        ...options
      });

      if (!ocrResult.success) {
        return res.status(500).json(ApiResponse.serverError('OCR processing failed', ocrResult.error));
      }

      // 3. Save evidence records
      console.log('💾 Saving evidence records...');
      const evidenceRecords = await this.saveEvidenceRecordsOptimized(ocrResult.evidence, imageId, actualUserId);

      // 4. Extract text for summary
      const allText = evidenceRecords.map(ev => ev.text).join(' ');
      
      // 5. Generate summary only (no mind map yet)
      console.log('📝 Generating summary...');
      const summary = await this.generateSummary(allText, evidenceRecords);

      // 6. Generate embeddings for semantic search (async)
      this.generateEmbeddingsAsync(allText, actualUserId, imageId);

      // 7. Create session for this image processing
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session = new Session({
        sessionId,
        userId: actualUserId,
        title: `Study Session from Image ${imageId}`,
        description: `Generated study session with ${evidenceRecords.length} concepts from uploaded image`,
        tags: ['auto-generated', 'image-processing'],
        source: {
          uploadFilename: imageId,
          imageUrl: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${imageId}`
        },
        status: 'active'
      });

      await session.save();

      // 8. Save processing result with summary
      const processingResult = {
        imageId,
        userId: actualUserId,
        sessionId: session.sessionId,
        summary,
        evidenceCount: evidenceRecords.length,
        processingTime: Date.now() - startTime,
        status: 'completed',
        createdAt: new Date()
      };

      // Return standardized response with summary and evidence only
      return res.json(ApiResponse.success('Image processed successfully', {
        imageId,
        sessionId: session.sessionId,
        summary,
        evidence: evidenceRecords.map(ev => ({
          id: ev._id,
          text: ev.text,
          confidence: ev.confidence,
          bbox: ev.bbox,
          ocrMethod: 'qwen-vision-api' // Use consistent method name
        })),
        evidenceCount: evidenceRecords.length,
        processingTime: Date.now() - startTime,
        message: 'Image uploaded and processed. Session created. Use /api/mindmap/:imageId to generate mind map and /api/quiz/:imageId to generate quiz.'
      }));

    } catch (error) {
      console.error('❌ Image processing error:', error);
      return res.status(500).json(ApiResponse.serverError('Image processing failed', error));
    }
  }

  /**
   * Generate mind map from stored image data
   */
  async generateMindMap(req, res) {
    try {
      const { imageId } = req.params;
      const userId = req.user?._id || 'dev-user-123';

      if (!imageId) {
        return res.status(400).json(ApiResponse.error('imageId is required'));
      }

      console.log(`🧠 Generating mind map for image ${imageId}`);

      // Debug: Check what evidence exists in the database
      const allEvidence = await Evidence.find({}).limit(5);
      console.log(`🔍 Total evidence records in DB: ${allEvidence.length}`);
      if (allEvidence.length > 0) {
        console.log(`📋 Sample evidence record:`, {
          originalImageId: allEvidence[0].originalImageId,
          imageUrl: allEvidence[0].imageUrl,
          text: allEvidence[0].text.substring(0, 100) + '...'
        });
      }

      // Fetch evidence for this image - use originalImageId field
      let evidence = await Evidence.find({ originalImageId: imageId });
      
      if (!evidence || evidence.length === 0) {
        console.log(`⚠️ No evidence found for imageId: ${imageId}`);
        console.log(`🔍 Trying alternative search methods...`);
        
        // Try alternative search methods
        let alternativeEvidence = await Evidence.find({ 
          $or: [
            { originalImageId: imageId },
            { imageUrl: { $regex: imageId, $options: 'i' } }
          ]
        });
        
        if (!alternativeEvidence || alternativeEvidence.length === 0) {
          // Check if imageId might be a Cloudinary public ID
          const cloudinaryId = imageId.replace('ai-study-helper/', '');
          alternativeEvidence = await Evidence.find({ 
            $or: [
              { originalImageId: cloudinaryId },
              { originalImageId: `ai-study-helper/${cloudinaryId}` }
            ]
          });
        }
        
        if (!alternativeEvidence || alternativeEvidence.length === 0) {
          return res.status(404).json(ApiResponse.notFound(`No evidence found for image: ${imageId}. Please ensure the image has been processed first.`));
        }
        
        evidence = alternativeEvidence;
        console.log(`✅ Found ${evidence.length} evidence records using alternative search`);
      }

      // Extract text content from evidence
      const textContent = evidence.map(ev => ev.text).join(' ');
      console.log(`📝 Extracted text content length: ${textContent.length} characters`);
      console.log(`📋 Sample text: ${textContent.substring(0, 200)}...`);
      
      // Generate meaningful mind map from the actual content
      const mindMap = await this.createMeaningfulMindMap(textContent, evidence);

      return res.json(ApiResponse.success('Mind map generated successfully', mindMap));
      
    } catch (error) {
      console.error('❌ Mind map generation error:', error);
      return res.status(500).json(ApiResponse.serverError('Mind map generation failed', error));
    }
  }

  /**
   * Get processing status
   */
  async getProcessingStatus(req, res) {
    try {
      const { imageId } = req.params;
      
      if (!imageId) {
        return res.status(400).json(ApiResponse.error('imageId is required'));
      }

      // Check if image exists and get status
      const status = await this.getImageStatus(imageId);
      
      if (!status) {
        return res.status(404).json(ApiResponse.notFound('Image not found'));
      }

      return res.json(ApiResponse.success('Status retrieved successfully', status));

    } catch (error) {
      console.error('❌ Status check error:', error);
      return res.status(500).json(ApiResponse.serverError('Status check failed', error));
    }
  }

  /**
   * Optimized image buffer retrieval with caching
   */
  async getImageBuffer(imageId) {
    try {
      console.log(`Fetching image buffer for ${imageId}`);
      
      // Import cloudinary here to avoid circular dependencies
      const cloudinary = require('cloudinary').v2;
      
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
      
      // Try different ways to construct the image ID
      let fullImageId = imageId;
      
      // If imageId doesn't already include the folder, add it
      if (!imageId.includes('ai-study-helper/')) {
        fullImageId = `ai-study-helper/${imageId}`;
      }
      
      console.log(`Trying to fetch image with ID: ${fullImageId}`);
      
      try {
        // Get the image URL from Cloudinary
        const result = await cloudinary.api.resource(fullImageId);
        
        if (!result.secure_url) {
          console.error('No secure URL found for image:', imageId);
          return null;
        }
        
        // Download the image buffer using axios with timeout
        const response = await axios.get(result.secure_url, {
          responseType: 'arraybuffer',
          timeout: 10000 // 10 second timeout
        });
        
        const buffer = Buffer.from(response.data);
        console.log(`Successfully fetched image buffer: ${buffer.length} bytes`);
        
        return buffer;
        
      } catch (cloudinaryError) {
        console.log(`Failed with full ID ${fullImageId}, trying alternative approaches...`);
        
        // Try without folder prefix
        if (fullImageId.startsWith('ai-study-helper/')) {
          const alternativeId = fullImageId.replace('ai-study-helper/', '');
          console.log(`Trying alternative ID: ${alternativeId}`);
          
          try {
            const result = await cloudinary.api.resource(alternativeId);
            if (result.secure_url) {
              const response = await axios.get(result.secure_url, {
                responseType: 'arraybuffer',
                timeout: 10000
              });
              const buffer = Buffer.from(response.data);
              console.log(`Successfully fetched image buffer with alternative ID: ${buffer.length} bytes`);
              return buffer;
            }
          } catch (altError) {
            console.log(`Alternative ID also failed: ${altError.message}`);
          }
        }
        
        throw cloudinaryError;
      }
      
    } catch (error) {
      console.error('Failed to fetch image buffer:', {
        request_options: error.request_options,
        query_params: error.query_params,
        error: error.error
      });
      return null;
    }
  }

  /**
   * Optimized evidence records saving with batch operations
   */
  async saveEvidenceRecordsOptimized(evidenceData, imageId, userId) {
    const evidenceRecords = [];
    
    // Batch create evidence records
    const evidencePromises = evidenceData.map(async (ev) => {
      const imageUrl = ev.imageUrl || `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/ai-study-helper/${imageId}`;
      
      const evidence = new Evidence({
        imageUrl: imageUrl,
        originalImageId: imageId,
        bbox: ev.bbox,
        text: ev.text,
        ocrConfidence: ev.ocrConfidence,
        ocrMethod: ev.ocrMethod,
        contentType: ev.contentType,
        metadata: ev.metadata
      });
      
      return evidence.save();
    });
    
    // Wait for all evidence records to be saved
    const savedEvidence = await Promise.all(evidencePromises);
    evidenceRecords.push(...savedEvidence);
    
    return evidenceRecords;
  }

  /**
   * Async embedding generation (non-blocking)
   */
  async generateEmbeddingsAsync(text, userId, imageId) {
    try {
      const embedding = await nlpService.generateEmbeddings(text);
      console.log(`Generated ${embedding.length}-dimensional embedding for image ${imageId}`);
      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return null;
    }
  }

  /**
   * Generate overall summary
   */
  async generateSummary(text, evidence) {
    try {
      // Simple summary generation - you can enhance this
      const words = text.split(' ').slice(0, 20).join(' ');
      return `${words}...`;
    } catch (error) {
      console.error('Summary generation error:', error);
      return 'Summary generation failed';
    }
  }

  async createMindMapStructure(summary, evidence) {
    try {
      // Create a simple mind map structure
      const rootNode = {
        id: 'root',
        text: 'Main Topic',
        children: []
      };

      // Add evidence as child nodes
      if (evidence && evidence.length > 0) {
        evidence.forEach((ev, index) => {
          rootNode.children.push({
            id: `node_${index}`,
            text: ev.text.substring(0, 30) + '...',
            children: []
          });
        });
      }

      return {
        root: rootNode,
        summary,
        nodeCount: rootNode.children.length
      };
    } catch (error) {
      console.error('Mind map structure creation error:', error);
      return { root: { id: 'root', text: 'Error', children: [] } };
    }
  }

  async getStoredImageData(imageId) {
    // This should fetch from your database
    // For now, return mock data
    return {
      imageId,
      summary: 'Sample summary for mind map generation',
      evidence: [{ text: 'Sample evidence text' }]
    };
  }

  async getImageStatus(imageId) {
    // This should check your database
    // For now, return mock status
    return {
      imageId,
      status: 'completed',
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Async chat history logging (non-blocking)
   */
  async logChatHistoryAsync(userId, sessionId, role, text) {
    try {
      const chatEntry = new ChatHistoryEntry({
        userId,
        sessionId,
        role,
        text,
        messageType: role === 'assistant' ? 'quiz_generation' : 'question'
      });
      
      await chatEntry.save();
    } catch (error) {
      console.error('Failed to log chat history:', error);
    }
  }

  async createMeaningfulMindMap(textContent, evidence) {
    try {
      // Extract key concepts from the actual text content
      const concepts = this.extractKeyConcepts(textContent);
      const mainTopics = this.identifyMainTopics(concepts);
      
      // Create root node with meaningful title
      const rootNode = { 
        id: 'root', 
        text: 'Study Content Analysis', 
        children: [] 
      };
      
      // Add main topics as children
      mainTopics.forEach((topic, index) => {
        const mainNode = { 
          id: `main_${index}`, 
          text: topic.name, 
          children: [] 
        };
        
        // Add sub-topics
        topic.subTopics.forEach((subTopic, subIndex) => {
          mainNode.children.push({ 
            id: `sub_${index}_${subIndex}`, 
            text: subTopic, 
            children: [] 
          });
        });
        
        rootNode.children.push(mainNode);
      });
      
      return {
        root: rootNode,
        summary: `Mind map generated from image content with ${mainTopics.length} main topics and ${mainTopics.reduce((sum, topic) => sum + topic.subTopics.length, 0)} sub-topics.`,
        nodeCount: rootNode.children.length,
        mainTopics: mainTopics.length,
        subTopics: mainTopics.reduce((sum, topic) => sum + topic.subTopics.length, 0),
        evidenceCount: evidence.length,
        sourceImageId: evidence[0]?.imageId || 'unknown'
      };
      
    } catch (error) {
      console.error('❌ Mind map creation failed:', error);
      // Fallback to simple structure
      return {
        root: {
          id: 'root',
          text: 'Study Content',
          children: [{
            id: 'fallback',
            text: 'Content extracted from image',
            children: []
          }]
        },
        summary: 'Fallback mind map generated due to processing error.',
        nodeCount: 1,
        mainTopics: 1,
        subTopics: 0,
        evidenceCount: evidence.length
      };
    }
  }

  /**
   * Extract key concepts from text content
   */
  extractKeyConcepts(textContent) {
    try {
      if (!textContent || textContent.length < 10) {
        return [];
      }

      // Simple concept extraction based on text analysis
      const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const concepts = [];

      sentences.forEach((sentence, index) => {
        const words = sentence.trim().split(/\s+/);
        if (words.length >= 3) {
          // Extract meaningful phrases (3+ words)
          const phrase = words.slice(0, Math.min(5, words.length)).join(' ');
          concepts.push({
            id: `concept_${index}`,
            text: phrase,
            confidence: 0.8,
            source: sentence
          });
        }
      });

      // Limit to top concepts
      return concepts.slice(0, 8);
    } catch (error) {
      console.error('❌ Concept extraction failed:', error);
      return [];
    }
  }

  /**
   * Identify main topics from extracted concepts
   */
  identifyMainTopics(concepts) {
    try {
      if (!concepts || concepts.length === 0) {
        return [{
          name: 'General Content',
          subTopics: ['Content Analysis', 'Text Processing']
        }];
      }

      // Group concepts into main topics
      const mainTopics = [];
      
      // Topic 1: Core Concepts
      const coreConcepts = concepts.slice(0, Math.min(3, concepts.length));
      if (coreConcepts.length > 0) {
        mainTopics.push({
          name: 'Core Concepts',
          subTopics: coreConcepts.map(c => c.text.substring(0, 30))
        });
      }

      // Topic 2: Supporting Information
      const supportingConcepts = concepts.slice(3, Math.min(6, concepts.length));
      if (supportingConcepts.length > 0) {
        mainTopics.push({
          name: 'Supporting Information',
          subTopics: supportingConcepts.map(c => c.text.substring(0, 30))
        });
      }

      // Topic 3: Additional Details
      const additionalConcepts = concepts.slice(6);
      if (additionalConcepts.length > 0) {
        mainTopics.push({
          name: 'Additional Details',
          subTopics: additionalConcepts.map(c => c.text.substring(0, 30))
        });
      }

      // If no topics were created, create a default one
      if (mainTopics.length === 0) {
        mainTopics.push({
          name: 'Study Content',
          subTopics: ['Content Analysis', 'Information Processing']
        });
      }

      return mainTopics;
    } catch (error) {
      console.error('❌ Topic identification failed:', error);
      return [{
        name: 'Study Content',
        subTopics: ['Content Analysis', 'Information Processing']
      }];
    }
  }
}

module.exports = new ProcessController();
