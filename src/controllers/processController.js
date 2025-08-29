const ocrService = require('../services/ocrService');
const pdfService = require('../services/pdfService');
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
   * File upload and processing endpoint (supports images and PDFs)
   * Only stores summary, doesn't generate mind map immediately
   */
  async processFile(req, res) {
    const startTime = Date.now();
    
    try {
      const { imageId, userId, options = {} } = req.body;
      const actualUserId = userId || req.user?._id || 'dev-user-123';
      
      if (!imageId) {
        return res.status(400).json(ApiResponse.error('imageId is required'));
      }

      console.log(`🚀 Starting file processing for user ${actualUserId}, file ${imageId}`);
      
      // 1. Get file buffer and metadata
      const { fileBuffer, fileType, originalName } = await this.getFileBuffer(imageId);
      if (!fileBuffer) {
        return res.status(404).json(ApiResponse.notFound('File not found'));
      }

      let processingResult;
      let evidenceRecords = [];

      // 2. Process based on file type
      if (fileType === 'image') {
        console.log('📸 Processing image file...');
        const ocrResult = await ocrService.processImageOptimized(fileBuffer, {
          originalImageId: imageId,
          ...options
        });

        if (!ocrResult.success) {
          return res.status(500).json(ApiResponse.serverError('OCR processing failed', ocrResult.error));
        }

        evidenceRecords = ocrResult.evidence;
        processingResult = {
          method: 'ocr',
          totalRegions: ocrResult.totalRegions,
          averageConfidence: ocrResult.averageConfidence
        };

      } else if (fileType === 'pdf') {
        console.log('📄 Processing PDF file...');
        const pdfResult = await pdfService.processPDF(fileBuffer, {
          originalImageId: imageId,
          ...options
        });

        if (!pdfResult.success) {
          return res.status(500).json(ApiResponse.serverError('PDF processing failed', pdfResult.error));
        }

        evidenceRecords = pdfResult.evidence;
        processingResult = {
          method: 'pdf-parse',
          totalPages: pdfResult.totalPages,
          totalRegions: pdfResult.totalRegions,
          averageConfidence: pdfResult.averageConfidence,
          metadata: pdfResult.metadata
        };

      } else {
        return res.status(400).json(ApiResponse.error('Unsupported file type'));
      }

      // 3. Save evidence records
      console.log('💾 Saving evidence records...');
      const savedEvidenceRecords = await this.saveEvidenceRecordsOptimized(evidenceRecords, imageId, actualUserId);

      // 4. Extract text for summary
      const allText = savedEvidenceRecords.map(ev => ev.text).join(' ');
      
      // 5. Generate summary only (no mind map yet)
      console.log('📝 Generating summary...');
      const summary = await this.generateSummary(allText, savedEvidenceRecords);

      // 6. Generate embeddings for semantic search (async)
      this.generateEmbeddingsAsync(allText, actualUserId, imageId);

      // 7. Create session for this file processing
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session = new Session({
        sessionId,
        userId: actualUserId,
        title: `Study Session from ${fileType === 'pdf' ? 'PDF' : 'Image'} ${originalName || imageId}`,
        description: `Generated study session with ${savedEvidenceRecords.length} concepts from uploaded ${fileType}`,
        tags: ['auto-generated', `${fileType}-processing`],
        source: {
          uploadFilename: originalName || imageId,
          fileType: fileType,
          fileUrl: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/${fileType === 'pdf' ? 'raw' : 'image'}/upload/${imageId}`
        },
        status: 'active'
      });

      await session.save();

      // 8. Save processing result with summary
      const finalProcessingResult = {
        imageId,
        userId: actualUserId,
        sessionId: session.sessionId,
        summary,
        evidenceCount: savedEvidenceRecords.length,
        processingTime: Date.now() - startTime,
        status: 'completed',
        createdAt: new Date(),
        fileType: fileType,
        ...processingResult
      };

      // Return standardized response with summary and evidence only
      return res.json(ApiResponse.success(`${fileType === 'pdf' ? 'PDF' : 'Image'} processed successfully`, {
        imageId,
        sessionId: session.sessionId,
        summary,
        evidence: savedEvidenceRecords.map(ev => ({
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

      // Check if file exists and get status
      const status = await this.getFileStatus(imageId);
      
      if (!status) {
        return res.status(404).json(ApiResponse.notFound('File not found'));
      }

      return res.json(ApiResponse.success('Status retrieved successfully', status));

    } catch (error) {
      console.error('❌ Status check error:', error);
      return res.status(500).json(ApiResponse.serverError('Status check failed', error));
    }
  }

  /**
   * Optimized file buffer retrieval with caching
   */
  async getFileBuffer(imageId) {
    try {
      console.log(`Fetching file buffer for ${imageId}`);
      
      // Import cloudinary here to avoid circular dependencies
      const cloudinary = require('cloudinary').v2;
      
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
      
      // Try multiple ID formats systematically
      const possibleIds = [
        imageId, // Original ID as-is
        `ai-study-helper/${imageId}`, // With folder prefix
        imageId.replace('ai-study-helper/', '') // Without folder prefix
      ];
      
      console.log(`🔍 Trying multiple ID formats:`, possibleIds);
      
      for (const currentId of possibleIds) {
        try {
          console.log(`🔄 Trying ID: ${currentId}`);
          
          // Try as image first
          try {
            const imageResult = await cloudinary.api.resource(currentId, { resource_type: 'image' });
            console.log('✅ File found as image');
            
            const fileBuffer = await this.downloadFileBuffer(imageResult.secure_url);
            return {
              fileBuffer,
              fileType: 'image',
              originalName: imageResult.original_filename || imageId
            };
          } catch (imageError) {
            console.log('❌ Not an image, trying as raw file...');
            
            // Try as raw file (PDF)
            try {
              const rawResult = await cloudinary.api.resource(currentId, { resource_type: 'raw' });
              console.log('✅ File found as raw file (PDF)');
              
              const fileBuffer = await this.downloadFileBuffer(rawResult.secure_url);
              return {
                fileBuffer,
                fileType: 'pdf',
                originalName: rawResult.original_filename || imageId
              };
            } catch (rawError) {
              console.log(`❌ ID ${currentId} failed for both types`);
              continue; // Try next ID format
            }
          }
          
        } catch (idError) {
          console.log(`❌ ID ${currentId} not found, trying next...`);
          continue;
        }
      }
      
      // If we get here, none of the ID formats worked
      console.error('❌ All ID formats failed for file:', imageId);
      return null;
      
    } catch (error) {
      console.error('Failed to fetch file buffer:', {
        request_options: error.request_options,
        query_params: error.query_params,
        error: error.error
      });
      return null;
    }
  }

  /**
   * Download file buffer from URL
   */
  async downloadFileBuffer(fileUrl) {
    try {
      // Download the file buffer using axios with timeout
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'AI-Study-Helper/1.0'
        }
      });
      
      const buffer = Buffer.from(response.data);
      console.log(`Successfully downloaded file buffer: ${buffer.length} bytes`);
      
      return buffer;
    } catch (error) {
      console.error('Failed to download file buffer:', error);
      
      // If it's a 401/403 error, try to get a signed URL from Cloudinary
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('🔄 Access denied, trying to get signed URL...');
        try {
          // Extract file ID from URL and try to get a signed URL
          const urlParts = fileUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const resourceType = fileUrl.includes('/raw/') ? 'raw' : 'image';
          
          // Get signed URL with transformation
          const signedUrl = cloudinary.url(fileName, {
            resource_type: resourceType,
            sign_url: true,
            type: 'upload',
            secure: true,
            folder: 'ai-study-helper' // Include folder for proper path
          });
          
          console.log('🔑 Generated signed URL, retrying download...');
          const signedResponse = await axios.get(signedUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          
          const signedBuffer = Buffer.from(signedResponse.data);
          console.log(`✅ Successfully downloaded with signed URL: ${signedBuffer.length} bytes`);
          return signedBuffer;
          
        } catch (signedError) {
          console.error('❌ Signed URL also failed:', signedError.message);
          
          // Try one more approach: get the file directly via Cloudinary API
          try {
            console.log('🔄 Trying direct Cloudinary API download...');
            const urlParts = fileUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const resourceType = fileUrl.includes('/raw/') ? 'raw' : 'image';
            
            // Get file info first
            const fileInfo = await cloudinary.api.resource(fileName, { 
              resource_type: resourceType,
              type: 'upload'
            });
            
            // Try to download using the secure URL with authentication
            const directResponse = await axios.get(fileInfo.secure_url, {
              responseType: 'arraybuffer',
              timeout: 15000,
              headers: {
                'User-Agent': 'AI-Study-Helper/1.0'
              }
            });
            
            const directBuffer = Buffer.from(directResponse.data);
            console.log(`✅ Successfully downloaded via direct API: ${directBuffer.length} bytes`);
            return directBuffer;
            
          } catch (directError) {
            console.error('❌ Direct API download also failed:', directError.message);
            throw error; // Throw original error
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Optimized evidence records saving with batch operations
   */
  async saveEvidenceRecordsOptimized(evidenceData, imageId, userId) {
    const evidenceRecords = [];
    
    // Batch create evidence records
    const evidencePromises = evidenceData.map(async (ev) => {
      const fileUrl = ev.imageUrl || ev.fileUrl || `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/ai-study-helper/${imageId}`;
      
      const evidence = new Evidence({
        fileUrl: fileUrl,
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
   * Generate robust AI-powered summary
   */
  async generateSummary(text, evidence) {
    try {
      if (!text || text.trim().length === 0) {
        return 'No text content available for summary generation.';
      }

      // If we have evidence records, create a comprehensive summary
      if (evidence && evidence.length > 0) {
        const evidenceTexts = evidence.map(ev => ev.text).join(' ');
        const combinedText = `${text}\n\nEvidence Details:\n${evidenceTexts}`;
        
        // Create a structured summary based on content analysis
        const summary = this.createStructuredSummary(combinedText, evidence);
        return summary;
      }

      // Fallback: create summary from main text
      return this.createStructuredSummary(text, []);
      
    } catch (error) {
      console.error('Summary generation error:', error);
      return 'Summary generation failed';
    }
  }

  /**
   * Create structured summary from content analysis
   */
  createStructuredSummary(text, evidence) {
    try {
      // Analyze content type and create appropriate summary
      const hasMath = /[+\-*/=()\[\]{}^]/.test(text);
      const hasChemistry = /(molality|boiling point|freezing point|osmotic pressure|vapor pressure|solute|solvent)/i.test(text);
      const hasPhysics = /(force|velocity|acceleration|energy|power|mass|weight)/i.test(text);
      const hasBiology = /(cell|organism|species|evolution|genetics|ecosystem)/i.test(text);
      
      let contentType = 'General Content';
      if (hasChemistry) contentType = 'Chemistry Notes';
      else if (hasPhysics) contentType = 'Physics Notes';
      else if (hasBiology) contentType = 'Biology Notes';
      else if (hasMath) contentType = 'Mathematical Content';
      
      // Extract key concepts (first 100-150 characters for readability)
      const keyContent = text.length > 150 ? text.substring(0, 150) + '...' : text;
      
      // Create structured summary
      let summary = `📚 ${contentType}\n\n`;
      summary += `🔍 Content Overview:\n${keyContent}\n\n`;
      
      if (evidence && evidence.length > 0) {
        summary += `📊 Evidence Records: ${evidence.length} sections identified\n`;
        summary += `📝 Key Topics: ${this.extractKeyTopics(text)}\n`;
        summary += `🔬 Content Type: ${this.detectContentCategory(text)}`;
      }
      
      return summary;
      
    } catch (error) {
      console.error('Structured summary creation error:', error);
      return text.length > 200 ? text.substring(0, 200) + '...' : text;
    }
  }

  /**
   * Extract key topics from text
   */
  extractKeyTopics(text) {
    try {
      const topics = [];
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      // Look for topic indicators
      lines.forEach(line => {
        if (line.includes('-') || line.includes('•') || line.includes(':')) {
          const topic = line.split(/[-•:]/)[1]?.trim();
          if (topic && topic.length > 3 && topic.length < 50) {
            topics.push(topic);
          }
        }
      });
      
      return topics.length > 0 ? topics.slice(0, 3).join(', ') : 'General content';
    } catch (error) {
      return 'General content';
    }
  }

  /**
   * Detect content category
   */
  detectContentCategory(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('chemistry') || lowerText.includes('molality') || lowerText.includes('boiling point')) {
      return 'Chemistry - Physical Chemistry';
    } else if (lowerText.includes('physics') || lowerText.includes('force') || lowerText.includes('energy')) {
      return 'Physics';
    } else if (lowerText.includes('biology') || lowerText.includes('cell') || lowerText.includes('organism')) {
      return 'Biology';
    } else if (lowerText.includes('math') || lowerText.includes('equation') || lowerText.includes('formula')) {
      return 'Mathematics';
    } else {
      return 'General Study Material';
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

  async getFileStatus(imageId) {
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
