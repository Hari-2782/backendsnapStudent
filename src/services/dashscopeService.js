const OpenAI = require('openai');

class DashScopeService {
  constructor() {
    // Check if DashScope API key is available
    if (!process.env.DASHSCOPE_API_KEY) {
      console.log('⚠️  DashScope API key not configured. Service will not be available.');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      });
    }
    
    this.model = "qwen-vl-max";
    this.maxRetries = 3;
    this.timeout = 60000; // 60 seconds
    
    // Token limiting configuration
    this.defaultMaxTokens = 2000;
    this.minTokens = 10;
    this.maxTokens = 8000;
    
    // Rate limiting
    this.requestsPerMinute = 60;
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }

  /**
   * Process image with Qwen-VL for OCR fallback
   */
  async processImageOCR(imageBuffer, options = {}) {
    try {
      if (!this.client) {
        return {
          success: false,
          error: 'DashScope service not configured',
          method: 'qwen-vl-fallback'
        };
      }

      // Validate API key
      if (!this.validateApiKey()) {
        return {
          success: false,
          error: 'Invalid API key format',
          method: 'qwen-vl-fallback'
        };
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          method: 'qwen-vl-fallback'
        };
      }

      console.log('🔄 Using DashScope Qwen-VL as OCR fallback...');
      
      // Validate and normalize options
      const validatedOptions = this.validateTokenLimits(options);
      
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      const prompt = options.prompt || "Please extract all the text content from this image. Return only the extracted text without any additional explanations or formatting.";
      
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { url: dataUrl }
              }
            ]
          }
        ],
        stream: false,
        top_p: validatedOptions.topP,
        temperature: validatedOptions.temperature,
        max_tokens: validatedOptions.maxTokens
      });

      const extractedText = completion.choices[0].message.content;
      
      // Debug logging
      console.log('🔍 Extracted text from DashScope:', extractedText);
      console.log('🔍 Text length:', extractedText?.length || 0);
      
      // Generate evidence records from extracted text
      const evidenceRecords = await this.generateEvidenceFromText(extractedText, {
        ...options,
        ocrMethod: 'qwen-vl-fallback'
      });

      return {
        success: true,
        method: 'qwen-vl-fallback',
        results: evidenceRecords, // Changed from 'evidence' to 'results' to match OCR service expectation
        totalRegions: evidenceRecords.length,
        averageConfidence: 0.85, // Qwen-VL typically has high confidence
        extractedText: extractedText
      };

    } catch (error) {
      console.error('DashScope OCR fallback failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'qwen-vl-fallback'
      };
    }
  }

  /**
   * Process PDF with Qwen-VL for text extraction fallback
   */
  async processPDFFallback(pdfBuffer, options = {}) {
    try {
      console.log('🔄 Using DashScope Qwen-VL as PDF processing fallback...');
      
      // For PDFs, we'll use a generic prompt since Qwen-VL can't directly process PDFs
      // This would be used when pdf-parse fails
      const prompt = options.prompt || "Please analyze and extract the key information from this document. Focus on extracting readable text content and important concepts.";
      
      // Since we can't directly send PDF to Qwen-VL, this would be a fallback
      // for when other PDF processing methods fail
      return {
        success: false,
        error: 'PDF processing not directly supported by Qwen-VL. Use pdf-parse service instead.',
        method: 'qwen-vl-fallback'
      };

    } catch (error) {
      console.error('DashScope PDF fallback failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'qwen-vl-fallback'
      };
    }
  }

  /**
   * RAG (Retrieval-Augmented Generation) with Qwen-VL
   */
  async processRAG(query, context, imageBuffer = null, options = {}) {
    try {
      if (!this.client) {
        return {
          success: false,
          error: 'DashScope service not configured',
          method: 'qwen-vl-rag'
        };
      }

      // Validate API key
      if (!this.validateApiKey()) {
        return {
          success: false,
          error: 'Invalid API key format',
          method: 'qwen-vl-rag'
        };
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          method: 'qwen-vl-rag'
        };
      }

      console.log('🔄 Using DashScope Qwen-VL for RAG processing...');
      
      // Validate and normalize options
      const validatedOptions = this.validateTokenLimits(options);
      
      let messages = [
        {
          role: "system",
          content: "You are an AI study assistant. Use the provided context to answer questions accurately and helpfully. If you don't know something, say so rather than making things up."
        }
      ];

      // Add context if provided
      if (context && context.length > 0) {
        const contextText = context.map(item => item.text || item.content).join('\n\n');
        messages.push({
          role: "user",
          content: `Context information:\n${contextText}\n\nQuestion: ${query}`
        });
      } else {
        messages.push({
          role: "user",
          content: query
        });
      }

      // Add image if provided
      if (imageBuffer) {
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;
        
        // Modify the last message to include image
        const lastMessage = messages[messages.length - 1];
        lastMessage.content = [
          { type: "text", text: lastMessage.content },
          { 
            type: "image_url", 
            image_url: { url: dataUrl }
          }
        ];
      }

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        stream: false,
        top_p: validatedOptions.topP,
        temperature: validatedOptions.temperature,
        max_tokens: validatedOptions.maxTokens
      });

      const response = completion.choices[0].message.content;

      return {
        success: true,
        method: 'qwen-vl-rag',
        response: response,
        model: this.model,
        usage: completion.usage
      };

    } catch (error) {
      console.error('DashScope RAG processing failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'qwen-vl-rag'
      };
    }
  }

  /**
   * Stream RAG response for real-time chat
   */
  async processRAGStream(query, context, imageBuffer = null, options = {}) {
    try {
      if (!this.client) {
        throw new Error('DashScope service not configured');
      }

      // Validate API key
      if (!this.validateApiKey()) {
        throw new Error('Invalid API key format');
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      console.log('🔄 Using DashScope Qwen-VL for streaming RAG processing...');
      
      // Validate and normalize options
      const validatedOptions = this.validateTokenLimits(options);
      
      let messages = [
        {
          role: "system",
          content: "You are an AI study assistant. Use the provided context to answer questions accurately and helpfully. If you don't know something, say so rather than making things up."
        }
      ];

      // Add context if provided
      if (context && context.length > 0) {
        const contextText = context.map(item => item.text || item.content).join('\n\n');
        messages.push({
          role: "user",
          content: `Context information:\n${contextText}\n\nQuestion: ${query}`
        });
      } else {
        messages.push({
          role: "user",
          content: query
        });
      }

      // Add image if provided
      if (imageBuffer) {
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;
        
        // Modify the last message to include image
        const lastMessage = messages[messages.length - 1];
        lastMessage.content = [
          { type: "text", text: lastMessage.content },
          { 
            type: "image_url", 
            image_url: { url: dataUrl }
          }
        ];
      }

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        stream: true,
        top_p: validatedOptions.topP,
        temperature: validatedOptions.temperature,
        max_tokens: validatedOptions.maxTokens
      });

      return completion;

    } catch (error) {
      console.error('DashScope streaming RAG failed:', error);
      throw error;
    }
  }

  /**
   * Generate evidence records from extracted text
   */
  async generateEvidenceFromText(text, options = {}) {
    const evidenceRecords = [];
    
    if (!text) return evidenceRecords;

    // Split text into chunks for better processing
    const chunks = this.splitTextIntoChunks(text, options.chunkSize || 500);
    
    console.log(`🔍 DashScope: Split text into ${chunks.length} chunks`);
    
    chunks.forEach((chunk, index) => {
      if (chunk.trim().length === 0) return;
      
      // Analyze chunk for mindmap structure
      const mindmapData = this.analyzeChunkForMindmap(chunk, index);
      
      const evidence = {
        text: chunk.trim(),
        ocrConfidence: 0.85, // High confidence for Qwen-VL
        ocrMethod: 'qwen-vl-fallback',
        contentType: this.detectContentType(chunk),
        bbox: {
          x: 0,
          y: index * 100, // Approximate position
          width: 800,
          height: 100
        },
        metadata: {
          language: 'en',
          regionType: 'text',
          lineCount: chunk.split('\n').length,
          wordCount: chunk.split(/\s+/).length,
          chunkIndex: index
        },
        // Enhanced mindmap structure
        mindmap: mindmapData
      };
      
      evidenceRecords.push(evidence);
    });

    console.log(`🔍 DashScope: Generated ${evidenceRecords.length} evidence records`);
    return evidenceRecords;
  }

  /**
   * Split text into manageable chunks
   */
  splitTextIntoChunks(text, chunkSize = 500) {
    const chunks = [];
    
    // Handle text without periods by splitting on newlines first
    let lines = text.split(/\n+/).filter(line => line.trim().length > 0);
    
    // If no newlines, try splitting by periods
    if (lines.length <= 1) {
      lines = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    }
    
    let currentChunk = '';
    
    lines.forEach(line => {
      const lineText = line.trim();
      
      if ((currentChunk + lineText).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = lineText;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + lineText;
      }
    });
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
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
   * Analyze chunk for mindmap structure
   */
  analyzeChunkForMindmap(chunk, index) {
    try {
      const lowerChunk = chunk.toLowerCase();
      
      // Chemistry-specific analysis
      if (lowerChunk.includes('boiling point') || lowerChunk.includes('elevation') || lowerChunk.includes('δtb')) {
        return {
          nodeType: 'parent',
          title: '🌡️ Boiling Point Elevation',
          category: 'Physical Chemistry',
          keyConcepts: ['ΔTb = kb × m', 'Ebullioscopic constant', 'Non-volatile solute'],
          formulas: this.extractFormulas(chunk),
          relationships: ['solute concentration', 'vapor pressure', 'temperature change']
        };
      }
      
      if (lowerChunk.includes('freezing point') || lowerChunk.includes('depression') || lowerChunk.includes('δtf')) {
        return {
          nodeType: 'parent',
          title: '❄️ Freezing Point Depression',
          category: 'Physical Chemistry',
          keyConcepts: ['ΔTf = kf × m', 'Cryoscopic constant', 'Solution freezing'],
          formulas: this.extractFormulas(chunk),
          relationships: ['solute effect', 'phase change', 'colligative property']
        };
      }
      
      if (lowerChunk.includes('osmotic pressure') || lowerChunk.includes('osmosis')) {
        return {
          nodeType: 'parent',
          title: '💧 Osmotic Pressure',
          category: 'Physical Chemistry',
          keyConcepts: ['π = cST', 'Semi-permeable membrane', 'Solvent flow'],
          formulas: this.extractFormulas(chunk),
          relationships: ['concentration gradient', 'membrane transport', 'pressure equilibrium']
        };
      }
      
      if (lowerChunk.includes('molality') || lowerChunk.includes('m.wt')) {
        return {
          nodeType: 'child',
          title: '📊 Concentration Units',
          category: 'Physical Chemistry',
          keyConcepts: ['Molality (m)', 'Molecular weight', 'Solution preparation'],
          formulas: this.extractFormulas(chunk),
          relationships: ['concentration calculation', 'solution preparation', 'colligative properties']
        };
      }
      
      // Default structure for other content
      return {
        nodeType: 'child',
        title: `📝 Section ${index + 1}`,
        category: 'General Content',
        keyConcepts: this.extractKeyConcepts(chunk),
        formulas: this.extractFormulas(chunk),
        relationships: ['content analysis', 'information extraction']
      };
      
    } catch (error) {
      console.error('Mindmap analysis error:', error);
      return {
        nodeType: 'child',
        title: `📝 Content ${index + 1}`,
        category: 'General',
        keyConcepts: [],
        formulas: [],
        relationships: []
      };
    }
  }

  /**
   * Extract formulas from text
   */
  extractFormulas(text) {
    const formulas = [];
    
    // Look for mathematical expressions
    const mathPatterns = [
      /ΔT[bf]\s*=\s*[k][bf]\s*[m]/g,  // ΔTb = kb m, ΔTf = kf m
      /π\s*=\s*cST/g,                   // π = cST
      /[k][bf]\s*=\s*[^,\n]+/g,         // kb = ..., kf = ...
      /R\s*=\s*0\.0821/g                // R = 0.0821
    ];
    
    mathPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        formulas.push(...matches);
      }
    });
    
    return formulas;
  }

  /**
   * Extract key concepts from text
   */
  extractKeyConcepts(text) {
    const concepts = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    lines.forEach(line => {
      // Look for key terms after dashes or colons
      if (line.includes('-') || line.includes(':')) {
        const parts = line.split(/[-:]/);
        if (parts.length > 1) {
          const concept = parts[1]?.trim();
          if (concept && concept.length > 3 && concept.length < 100) {
            concepts.push(concept);
          }
        }
      }
      
      // Look for specific chemistry terms
      const chemistryTerms = [
        'molality', 'boiling point', 'freezing point', 'osmotic pressure',
        'vapor pressure', 'solute', 'solvent', 'colligative properties',
        'ebullioscopic', 'cryoscopic', 'osmosis', 'semi-permeable'
      ];
      
      chemistryTerms.forEach(term => {
        if (line.toLowerCase().includes(term) && !concepts.includes(term)) {
          concepts.push(term);
        }
      });
    });
    
    return concepts.slice(0, 5); // Limit to 5 key concepts
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return !!process.env.DASHSCOPE_API_KEY;
  }

  /**
   * Validate and normalize token limits
   */
  validateTokenLimits(options = {}) {
    let maxTokens = options.maxTokens || this.defaultMaxTokens;
    
    // Ensure tokens are within bounds
    maxTokens = Math.max(this.minTokens, Math.min(this.maxTokens, maxTokens));
    
    return {
      maxTokens,
      temperature: Math.max(0, Math.min(2, options.temperature || 0.7)),
      topP: Math.max(0, Math.min(1, options.topP || 0.8))
    };
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if a minute has passed
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    // Check if we're over the limit
    if (this.requestCount >= this.requestsPerMinute) {
      return false;
    }
    
    this.requestCount++;
    return true;
  }

  /**
   * Validate API key format
   */
  validateApiKey() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) return false;
    
    // Basic validation - DashScope keys typically start with 'sk-'
    return apiKey.startsWith('sk-') && apiKey.length > 10;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      apiKeyValid: this.validateApiKey(),
      model: this.model,
      baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      tokenLimits: {
        min: this.minTokens,
        max: this.maxTokens,
        default: this.defaultMaxTokens
      },
      rateLimiting: {
        requestsPerMinute: this.requestsPerMinute,
        currentRequests: this.requestCount,
        timeUntilReset: Math.max(0, 60000 - (Date.now() - this.lastResetTime))
      }
    };
  }
}

module.exports = new DashScopeService();
