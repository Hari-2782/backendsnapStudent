const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const axios = require('axios');

class OCRService {
  constructor() {
    this.hfApiKey = process.env.HF_API_KEY;
    this.hfApiUrl = 'https://api-inference.huggingface.co/models';
    this.fallbackModels = [
      'microsoft/trocr-base-handwritten',
      'microsoft/trocr-large-handwritten',
      'microsoft/trocr-base-printed'
    ];
    
    // Cache for processed images
    this.imageCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Optimized OCR pipeline with fast response times
   */
  async processImageOptimized(imageBuffer, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(imageBuffer);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        console.log('📋 Using cached OCR result');
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime,
          fromCache: true
        };
      }

      // 1. Preprocess image (optimized)
      const preprocessedBuffer = await this.preprocessImageOptimized(imageBuffer, options);
      
      // 2. Run OCR with optimized settings
      console.log('🔍 Running optimized OCR...');
      const ocrResult = await this.runOptimizedOCR(preprocessedBuffer, options);
      
      // 3. Post-process and clean results
      const cleanedResults = await this.postProcessResultsOptimized(ocrResult);
      
      // 4. Generate evidence records
      const evidenceRecords = await this.generateEvidenceRecordsOptimized(cleanedResults, options);
      
      const processingTime = Date.now() - startTime;
      
      // Update method name to be more descriptive
      const ocrResults = {
        success: true,
        method: 'qwen-vision-api', // Changed from 'trocr' to be more descriptive
        evidence: evidenceRecords,
        processingTime: Date.now() - startTime,
        totalRegions: evidenceRecords.length,
        averageConfidence: this.calculateAverageConfidence(evidenceRecords),
        fallbackUsed: false
      };

      // Cache the result
      this.setCache(cacheKey, ocrResults);
      
      return ocrResults;
      
    } catch (error) {
      console.error('Optimized OCR processing failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Optimized image preprocessing
   */
  async preprocessImageOptimized(imageBuffer, options = {}) {
    try {
      let processed = sharp(imageBuffer);
      
      // Auto-rotate based on EXIF data
      processed = processed.rotate();
      
      // Optimize size for faster processing
      const metadata = await processed.metadata();
      if (metadata.width > 1500 || metadata.height > 1500) {
        processed = processed.resize(1500, 1500, { fit: 'inside' });
      }
      
      // Apply minimal enhancement for speed
      processed = processed
        .sharpen()
        .normalize();
      
      // Convert to grayscale for better OCR
      if (options.convertToGrayscale !== false) {
        processed = processed.grayscale();
      }
      
      return await processed.toBuffer();
      
    } catch (error) {
      console.error('Optimized image preprocessing failed:', error);
      return imageBuffer; // Return original if preprocessing fails
    }
  }

  /**
   * Optimized OCR using Llama Vision API
   */
  async runOptimizedOCR(imageBuffer, options = {}) {
    try {
             console.log('🖼️ Using Qwen Vision API for OCR...');
      
      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      // Create OCR prompt for Llama
      const ocrPrompt = `Please extract all text from this image. Return ONLY the text content, nothing else. If there are multiple lines, preserve the line breaks. If there are mathematical formulas, preserve them exactly as they appear.`;

             // Call Qwen Vision API
       const response = await this.callQwenVisionAPI(ocrPrompt, [dataUrl]);
      
      if (response && response.choices && response.choices[0]) {
        const extractedText = response.choices[0].message.content.trim();
        
        // Calculate confidence based on text quality
        let confidence = this.calculateTextConfidence(extractedText);
        
                 console.log('✅ Qwen Vision OCR completed');
        
                 return {
           method: 'qwen-vision-api',
           results: [{
             region: { x: 0, y: 0, width: 0, height: 0, confidence: confidence, type: 'text' },
             text: extractedText,
             confidence: confidence,
             method: 'trocr',
             fallbackUsed: false
           }],
           fallbackUsed: false
         };
      }
      
             throw new Error('Invalid response from Qwen Vision API');
      
    } catch (error) {
             console.error('Qwen Vision OCR failed:', error);
      
             // Fallback to Tesseract if Qwen fails
      console.log('🔄 Falling back to Tesseract OCR...');
      return await this.runTesseractFallback(imageBuffer, options);
    }
  }

  /**
   * Fallback Tesseract OCR method
   */
  async runTesseractFallback(imageBuffer, options = {}) {
    try {
      const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && m.progress === 1) {
            console.log('✅ Tesseract fallback completed');
          }
        },
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()[\\]{}+-*/=<>≤≥≠≈∞∑∏∫∂√∆∇∈∉⊂⊃∪∩∅∀∃',
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_do_invert: '0',
        textord_heavy_nr: '1',
        textord_min_linesize: '2.5'
      });
      
      let confidence = data.confidence / 100;
      if (data.text.trim().length > 10) confidence *= 1.2;
      if (data.text.match(/[0-9]/)) confidence *= 1.1;
      confidence = Math.min(confidence, 1.0);
      
      return {
        method: 'tesseract-fallback',
        results: [{
          region: { x: 0, y: 0, width: 0, height: 0, confidence: 0.7, type: 'text' },
          text: data.text.trim(),
          confidence: confidence,
          method: 'tesseract',
          fallbackUsed: true
        }],
        fallbackUsed: true
      };
      
    } catch (error) {
      console.error('Tesseract fallback failed:', error);
      throw error;
    }
  }

     /**
    * Call Qwen Vision API for OCR
    */
   async callQwenVisionAPI(prompt, imageUrls) {
    try {
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      const openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      const visionModel = 'qwen/qwen2.5-vl-32b-instruct:free';
      
      if (!openRouterApiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageUrls.map(url => ({ type: 'image_url', image_url: { url } }))
          ]
        }
      ];

      const response = await axios.post(openRouterApiUrl, {
        model: visionModel,
        messages: messages,
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for more accurate OCR
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app-domain.com',
          'X-Title': 'AI Study Helper'
        },
        timeout: 30000
      });

      return response.data;

    } catch (error) {
             console.error('Qwen Vision API call failed:', error);
             throw new Error(`Qwen Vision API failed: ${error.message}`);
    }
  }

  /**
   * Calculate confidence based on text quality
   */
  calculateTextConfidence(text) {
    if (!text || text.trim().length === 0) return 0.0;
    
    let confidence = 0.7; // Base confidence
    
    // Boost confidence for longer text
    if (text.length > 50) confidence += 0.1;
    if (text.length > 100) confidence += 0.1;
    
    // Boost confidence for text with numbers (often more reliable)
    if (text.match(/[0-9]/)) confidence += 0.1;
    
    // Boost confidence for text with proper spacing
    if (text.match(/\s/)) confidence += 0.05;
    
    // Reduce confidence for very short text
    if (text.length < 10) confidence -= 0.2;
    
    // Cap confidence between 0.3 and 1.0
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Optimized post-processing
   */
  async postProcessResultsOptimized(ocrResults) {
    const processed = [];
    
    // Handle both array and object with results property
    const resultsArray = Array.isArray(ocrResults) ? ocrResults : (ocrResults.results || []);
    
    for (const result of resultsArray) {
      if (!result.text || result.text.trim().length === 0) continue;
      
      let cleanedText = result.text
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s\-.,!?;:()[\]{}]/g, '') // Remove special characters
        .trim();
      
      // Skip very short text (likely noise)
      if (cleanedText.length < 3) continue;
      
      // Adjust confidence based on text quality
      let adjustedConfidence = result.confidence;
      if (cleanedText.length < 10) adjustedConfidence *= 0.9;
      if (cleanedText.match(/[0-9]/)) adjustedConfidence *= 1.1; // Numbers increase confidence
      
      processed.push({
        ...result,
        text: cleanedText,
        confidence: Math.min(adjustedConfidence, 1.0)
      });
    }
    
    // Return in the expected format
    return {
      results: processed,
      method: ocrResults.method || 'tesseract-optimized',
      fallbackUsed: ocrResults.fallbackUsed || false
    };
  }

  /**
   * Optimized evidence records generation
   */
  async generateEvidenceRecordsOptimized(ocrResults, options) {
    const evidenceRecords = [];
    
    // Ensure we have the correct structure
    if (!ocrResults || !ocrResults.results || !Array.isArray(ocrResults.results)) {
      console.error('Invalid OCR results structure:', ocrResults);
      return [];
    }
    
    console.log(`Generating evidence records from ${ocrResults.results.length} OCR results`);
    
    for (const result of ocrResults.results) {
      // Validate result structure
      if (!result || !result.text) {
        console.log('Skipping invalid result:', result);
        continue;
      }
      
      // Create evidence record without cropping (for speed)
      const imageUrl = await this.getImageUrl(options.originalImageId);
      
      // Determine the correct OCR method
      let ocrMethod = result.method || 'unknown';
      
      // If the overall method indicates Qwen vision, use that
      if (ocrResults.method === 'qwen-vision-api') {
        ocrMethod = 'trocr'; // Use trocr for Qwen vision results
      }
      
      evidenceRecords.push({
        imageUrl: imageUrl,
        bbox: result.region || { x: 0, y: 0, width: 0, height: 0 },
        text: result.text,
        ocrConfidence: result.confidence || 0.5,
        ocrMethod: ocrMethod,
        contentType: this.detectContentType(result.text),
        metadata: {
          language: 'en',
          regionType: 'text',
          lineCount: result.text.split('\n').length,
          wordCount: result.text.split(/\s+/).length
        }
      });
    }
    
    console.log(`Generated ${evidenceRecords.length} evidence records`);
    return evidenceRecords;
  }

  /**
   * Get image URL without cropping (for speed)
   */
  async getImageUrl(originalImageId) {
    try {
      const cloudinary = require('cloudinary').v2;
      
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
      
      // Get the original image URL
      const result = await cloudinary.api.resource(`ai-study-helper/${originalImageId}`);
      return result.secure_url;
      
    } catch (error) {
      console.error('Failed to get Cloudinary URL:', error);
      // Fallback to constructing URL manually
      return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/ai-study-helper/${originalImageId}`;
    }
  }

  /**
   * Detect content type from text
   */
  detectContentType(text) {
    const hasMath = /[+\-*/=()\[\]{}^]/.test(text);
    const hasNumbers = /\d/.test(text);
    const hasText = /[a-zA-Z]/.test(text);
    
    if (hasMath && hasNumbers) return 'equation';
    if (hasNumbers && !hasText) return 'diagram';
    if (hasText && !hasMath) return 'text';
    return 'mixed';
  }

  /**
   * Calculate average confidence across all evidence
   */
  calculateAverageConfidence(evidenceRecords) {
    if (evidenceRecords.length === 0) return 0;
    const total = evidenceRecords.reduce((sum, ev) => sum + ev.ocrConfidence, 0);
    return total / evidenceRecords.length;
  }

  /**
   * Cache management
   */
  generateCacheKey(imageBuffer) {
    // Simple hash of buffer for caching
    let hash = 0;
    for (let i = 0; i < Math.min(imageBuffer.length, 1000); i++) {
      const char = imageBuffer[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  getFromCache(key) {
    const cached = this.imageCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.imageCache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.imageCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.imageCache.size > 100) {
      const oldestKey = this.imageCache.keys().next().value;
      this.imageCache.delete(oldestKey);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async processImage(imageBuffer, options = {}) {
    return this.processImageOptimized(imageBuffer, options);
  }
}

module.exports = new OCRService();
