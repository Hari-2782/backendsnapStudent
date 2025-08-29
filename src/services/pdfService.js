const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const axios = require('axios');
const dashscopeService = require('./dashscopeService');

class PDFService {
  constructor() {
    this.maxPages = 50; // Limit to prevent abuse
    this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
  }

  /**
   * Process PDF and extract text content
   */
  async processPDF(pdfBuffer, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('📄 Processing PDF document...');
      
      // Validate file size
      if (pdfBuffer.length > this.maxFileSize) {
        throw new Error(`PDF file too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`);
      }

      // Extract text from PDF
      let pdfData;
      let processedText;
      let evidenceRecords;
      
      try {
        pdfData = await pdfParse(pdfBuffer, {
          max: this.maxPages,
          version: 'v2.0.550'
        });

        if (!pdfData || !pdfData.text) {
          throw new Error('No text content found in PDF');
        }

        // Process the extracted text
        processedText = this.cleanText(pdfData.text);
        
        // Generate evidence records from text
        evidenceRecords = await this.generateEvidenceFromText(processedText, options);
        
      } catch (pdfError) {
        console.log('📄 PDF parsing failed, trying DashScope fallback...');
        
        // Try DashScope fallback if available
        if (dashscopeService.isAvailable()) {
          const fallbackResult = await dashscopeService.processPDFFallback(pdfBuffer, options);
          if (fallbackResult.success) {
            evidenceRecords = fallbackResult.evidence;
            processedText = fallbackResult.extractedText || 'Text extracted via fallback method';
            pdfData = { numpages: 1, info: { Title: 'PDF processed via fallback' } };
          } else {
            throw new Error(`PDF processing failed: ${pdfError.message}`);
          }
        } else {
          throw new Error(`PDF processing failed: ${pdfError.message}`);
        }
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        method: 'pdf-parse',
        evidence: evidenceRecords,
        processingTime,
        totalPages: pdfData.numpages,
        totalRegions: evidenceRecords.length,
        averageConfidence: this.calculateAverageConfidence(evidenceRecords),
        metadata: {
          title: pdfData.info?.Title || 'Untitled PDF',
          author: pdfData.info?.Author || 'Unknown',
          subject: pdfData.info?.Subject || '',
          creator: pdfData.info?.Creator || '',
          producer: pdfData.info?.Producer || '',
          creationDate: pdfData.info?.CreationDate || '',
          modDate: pdfData.info?.ModDate || ''
        }
      };

    } catch (error) {
      console.error('PDF processing failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Convert PDF pages to images for OCR processing
   */
  async convertPDFToImages(pdfBuffer, options = {}) {
    try {
      console.log('🖼️ Converting PDF pages to images...');
      
      // For now, we'll use a simple approach
      // In a production environment, you might want to use pdf2pic or similar
      // This is a placeholder for the image conversion logic
      
      const images = [];
      // TODO: Implement PDF to image conversion
      // This would require additional dependencies like pdf2pic or puppeteer
      
      return {
        success: true,
        images,
        totalPages: images.length
      };
      
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean and normalize extracted text
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')   // Convert remaining carriage returns
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s+/g, ' ')   // Normalize whitespace
      .trim();
  }

  /**
   * Generate evidence records from text content
   */
  async generateEvidenceFromText(text, options = {}) {
    const evidenceRecords = [];
    
    if (!text) return evidenceRecords;

    // Split text into chunks for better processing
    const chunks = this.splitTextIntoChunks(text, options.chunkSize || 500);
    
    chunks.forEach((chunk, index) => {
      if (chunk.trim().length === 0) return;
      
      const evidence = {
        text: chunk.trim(),
        ocrConfidence: 1.0, // High confidence for direct text extraction
        ocrMethod: 'pdf-parse',
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
        }
      };
      
      evidenceRecords.push(evidence);
    });

    return evidenceRecords;
  }

  /**
   * Split text into manageable chunks
   */
  splitTextIntoChunks(text, chunkSize = 500) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    sentences.forEach(sentence => {
      const sentenceWithPunctuation = sentence.trim() + '.';
      
      if ((currentChunk + sentenceWithPunctuation).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentenceWithPunctuation;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
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
   * Calculate average confidence across all evidence
   */
  calculateAverageConfidence(evidenceRecords) {
    if (evidenceRecords.length === 0) return 0;
    
    const totalConfidence = evidenceRecords.reduce((sum, ev) => sum + (ev.ocrConfidence || 0), 0);
    return totalConfidence / evidenceRecords.length;
  }

  /**
   * Get PDF metadata
   */
  async getPDFMetadata(pdfBuffer) {
    try {
      const pdfData = await pdfParse(pdfBuffer, { max: 1 });
      return {
        numPages: pdfData.numpages,
        info: pdfData.info || {},
        version: pdfData.version
      };
    } catch (error) {
      console.error('Error getting PDF metadata:', error);
      return null;
    }
  }
}

module.exports = new PDFService();
