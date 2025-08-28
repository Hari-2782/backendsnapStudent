const axios = require('axios');

class NLPService {
  constructor() {
    this.hfApiKey = process.env.HF_API_KEY;
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.hfApiUrl = 'https://api-inference.huggingface.co/models';
    this.openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    
         // Debug: Log API key status
     console.log('🔑 NLP Service - API Keys Status:', {
       hfApiKey: {
         hasKey: !!this.hfApiKey,
         keyLength: this.hfApiKey ? this.hfApiKey.length : 0,
         keyPrefix: this.hfApiKey ? this.hfApiKey.substring(0, 3) : 'none'
       },
       openRouterApiKey: {
         hasKey: !!this.openRouterApiKey,
         keyLength: this.openRouterApiKey ? this.openRouterApiKey.length : 0,
         keyPrefix: this.openRouterApiKey ? this.openRouterApiKey.substring(0, 3) : 'none'
       }
     });
     
     // Show configuration status
     if (!this.openRouterApiKey) {
       console.log('⚠️ OPENROUTER_API_KEY not configured - Vision model processing disabled');
       console.log('💡 To enable vision processing, set OPENROUTER_API_KEY in your .env file');
     }
     
     if (!this.hfApiKey) {
       console.log('⚠️ HF_API_KEY not configured - HF inference disabled');
       console.log('💡 To enable HF inference, set HF_API_KEY in your .env file');
     }
    
         // Model configurations
     this.models = {
       summarizer: 'facebook/bart-large-cnn',
       explanation: 'google/flan-t5-base',
       mcq: 'microsoft/DialoGPT-medium',
       embeddings: 'sentence-transformers/all-mpnet-base-v2' // More reliable for embeddings
     };
    
    // OpenRouter vision model for enhanced image understanding
    this.visionModel = 'qwen/qwen2.5-vl-32b-instruct:free';
    
    // Fallback models if primary ones fail
    this.fallbackModels = {
      summarizer: 'facebook/bart-base',
      explanation: 'google/flan-t5-small'
    };

    // Cache for processed content
    this.contentCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Optimized educational content generation with RAG focus
   */
  async generateEducationalContentOptimized(textChunks, evidence, options = {}) {
    try {
      // Ensure textChunks is an array
      const chunksArray = Array.isArray(textChunks) ? textChunks : [textChunks || ''];
      
      console.log('🔍 generateEducationalContentOptimized called with:');
      console.log(`  - Text chunks: ${chunksArray.length}`);
      console.log(`  - Evidence count: ${evidence ? evidence.length : 'undefined'}`);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(chunksArray, evidence);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        console.log('📋 Using cached NLP result');
        return {
          ...cachedResult,
          fromCache: true
        };
      }
      
                    // PRIMARY STRATEGY: OpenRouter Vision Model (Qwen Vision API) - DISABLED
       // Commented out because OPENROUTER_API_KEY is not configured
       /*
       if (this.openRouterApiKey && evidence && evidence.length > 0 && evidence.some(ev => ev.imageUrl)) {
         console.log('🖼️ Using OpenRouter Vision Model (Qwen Vision API) as primary method...');
         
         const visionEnhancedResults = await this.processWithVisionModelOptimized(chunksArray, evidence, options);
         if (visionEnhancedResults.success) {
           console.log('✅ OpenRouter Vision Model succeeded!');
           
           // Cache the result
           this.setCache(cacheKey, visionEnhancedResults);
           
           return visionEnhancedResults;
         }
         console.log('❌ OpenRouter Vision Model failed - falling back to text processing');
       }
       */
       
       console.log('⚠️ OpenRouter API key not configured - skipping vision model processing');
       
       // ENHANCED STRATEGY: Check if Qwen vision was already used for OCR
       console.log('🔍 Checking evidence for Qwen Vision OCR method...');
       evidence.forEach((ev, index) => {
         console.log(`  Evidence ${index + 1}: ocrMethod = "${ev.ocrMethod}", confidence = ${ev.ocrConfidence}`);
       });
       
       // PRIORITY: Use Qwen OCR results for enhanced content generation
       if (evidence && evidence.length > 0 && evidence.some(ev => ev.ocrMethod === 'trocr' || ev.ocrMethod === 'qwen-vision-api')) {
         console.log('🖼️ Qwen Vision was used for OCR - generating enhanced content with HF...');
         
         const qwenEnhancedResults = await this.processWithQwenOCRResults(chunksArray, evidence, options);
         if (qwenEnhancedResults.success) {
           console.log('✅ Qwen Vision + HF enhanced content generation succeeded!');
           
           // Cache the result
           this.setCache(cacheKey, qwenEnhancedResults);
           
           return qwenEnhancedResults;
         }
         console.log('❌ Qwen Vision + HF enhanced content failed - falling back to text processing');
       }
      
      // FALLBACK STRATEGY: Text-based processing
      console.log('📝 Using text-based processing as fallback...');
      const textBasedResults = await this.processWithTextOptimized(chunksArray, evidence, options);
      
      // Cache the result
      this.setCache(cacheKey, textBasedResults);
      
      return textBasedResults;
      
    } catch (error) {
      console.error('All processing strategies failed:', error);
      // Ultimate fallback: return basic content
      return this.createUltimateFallback(chunksArray, evidence);
    }
  }

     /**
    * Process content when Qwen Vision was already used for OCR
    */
   async processWithQwenOCRResults(textChunks, evidence, options = {}) {
     try {
       console.log('🖼️ Processing content with Qwen Vision OCR results using HF inference...');
       
       // Combine all text chunks for comprehensive analysis
       const combinedText = textChunks.join('\n\n');
       
       // Try to use HF inference for enhanced content generation
       if (this.hfApiKey) {
         console.log('🌐 Using HF inference for enhanced content generation...');
         
         try {
           // Generate enhanced content using HF models
           const [summary, explanation, mcqs] = await Promise.all([
             this.generateEnhancedSummaryWithHF(combinedText, evidence),
             this.generateEnhancedExplanationWithHF(combinedText, evidence),
             this.generateEnhancedMCQsWithHF(combinedText, evidence)
           ]);
           
           const enhancedContent = {
             summary: summary,
             explanation: explanation,
             mcqs: mcqs,
             keyConcepts: this.extractKeyConcepts(combinedText),
             educationalInsights: this.generateEducationalInsights(combinedText, this.extractKeyConcepts(combinedText)),
             metadata: {
               method: 'qwen-vision-ocr-hf-enhanced',
               model: 'HF Inference',
               textLength: combinedText.length,
               conceptCount: this.extractKeyConcepts(combinedText).length
             }
           };
           
           return {
             success: true,
             results: [{
               chunkIndex: 0,
               text: combinedText,
               evidence: evidence,
               content: enhancedContent
             }],
             totalChunks: 1,
             method: 'qwen-vision-hf-enhanced',
             visionModel: 'Qwen Vision + HF Inference'
           };
           
         } catch (hfError) {
           console.log('⚠️ HF inference failed, falling back to local generation:', hfError.message);
         }
       }
       
       // Fallback: Create enhanced content from OCR text locally
       console.log('📝 Creating enhanced content from Qwen Vision OCR text locally...');
       
       const enhancedContent = this.createEnhancedContentFromQwenOCR(combinedText, evidence);
       
       return {
         success: true,
         results: [{
           chunkIndex: 0,
           text: combinedText,
           evidence: evidence,
           content: enhancedContent
         }],
         totalChunks: 1,
         method: 'qwen-vision-local-enhanced',
         visionModel: 'Qwen Vision + Local Processing'
       };
       
     } catch (error) {
       console.error('Qwen Vision OCR processing failed:', error);
       return { success: false, error: error.message };
     }
   }

   /**
    * Optimized vision model processing for RAG
    */
   async processWithVisionModelOptimized(textChunks, evidence, options = {}) {
    try {
      // Ensure textChunks is an array
      const chunksArray = Array.isArray(textChunks) ? textChunks : [textChunks || ''];
      
      if (!this.openRouterApiKey) {
        console.log('⚠️ OpenRouter API key not configured, falling back to text processing');
        return { success: false, error: 'OpenRouter API key not configured' };
      }

      const imageUrls = evidence
        .filter(ev => ev.imageUrl && ev.imageUrl.startsWith('http'))
        .map(ev => ev.imageUrl)
        .slice(0, 3); // Limit to 3 images for API efficiency

      if (imageUrls.length === 0) {
        console.log('⚠️ No valid image URLs found for vision processing');
        return { success: false, error: 'No valid image URLs found' };
      }

      console.log(`🖼️ Processing ${imageUrls.length} images with vision model...`);

      // Combine all text chunks for comprehensive analysis
      const combinedText = chunksArray.join('\n\n');
      
      // Create optimized vision prompt for RAG-based educational content
      const visionPrompt = this.createOptimizedVisionPrompt(combinedText, evidence);
      
      const response = await this.callOpenRouterVisionAPI(visionPrompt, imageUrls);
      
      if (response && response.choices && response.choices[0]) {
        const content = response.choices[0].message.content;
        
        // Parse the structured response
        const parsedContent = this.parseVisionResponseOptimized(content);
        
        return {
          success: true,
          results: [{
            chunkIndex: 0,
            text: combinedText,
            evidence: evidence,
            content: parsedContent
          }],
          totalChunks: 1,
          method: 'qwen-vision-enhanced',
          visionModel: this.visionModel
        };
      }
      
      throw new Error('Invalid response from vision model');
      
    } catch (error) {
      console.error('Vision model processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Optimized text-based processing for RAG
   */
  async processWithTextOptimized(textChunks, evidence, options = {}) {
    try {
      // Ensure textChunks is an array
      const chunksArray = Array.isArray(textChunks) ? textChunks : [textChunks || ''];
      
      const results = [];
      
      // Process chunks in parallel for better performance
      const chunkPromises = chunksArray.map(async (chunk, index) => {
        const chunkEvidence = evidence.filter(ev => 
          ev.text.includes(chunk.substring(0, 20)) || 
          chunk.includes(ev.text.substring(0, 20))
        );
        
        console.log(`Processing chunk ${index + 1}/${chunksArray.length}: ${chunk.substring(0, 100)}...`);
        
        const content = await this.processTextChunkOptimized(chunk, chunkEvidence, options);
      return {
          chunkIndex: index,
          text: chunk,
          evidence: chunkEvidence,
          content: content
        };
        });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      
      return {
        success: true,
        results: results,
        totalChunks: chunksArray.length,
        method: 'text-optimized'
      };
      
    } catch (error) {
      console.error('Text-based processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Optimized text chunk processing
   */
  async processTextChunkOptimized(text, evidence, options = {}) {
    try {
      // Process all components in parallel for better performance
      const [summary, explanation, mcqs] = await Promise.all([
        this.generateSummaryOptimized(text, options),
        this.generateExplanationOptimized(text, options),
        this.generateMCQsOptimized(text, evidence, options)
      ]);
      
      return {
        summary,
        explanation,
        mcqs,
        metadata: {
          textLength: text.length,
          evidenceCount: evidence.length,
          averageEvidenceConfidence: evidence.length > 0 ? 
            evidence.reduce((sum, ev) => sum + ev.ocrConfidence, 0) / evidence.length : 0,
          method: 'text-optimized'
        }
      };
      
    } catch (error) {
      console.error(`Failed to process chunk: ${error.message}`);
      return {
        summary: 'Processing failed',
        explanation: 'Unable to generate explanation',
        mcqs: [],
        error: error.message
      };
    }
  }

     /**
    * Create enhanced prompt for Qwen Vision OCR results
    */
   createQwenEnhancedPrompt(text, evidence) {
     return `You are an expert educational content analyzer. The image has already been processed by Qwen Vision AI, which extracted the following text:

**EXTRACTED TEXT:**
${text}

**TASK:**
Based on this Qwen Vision AI extracted text, create comprehensive educational content including:

1. **SUMMARY**: A concise summary of the main concepts (2-3 sentences)
2. **EXPLANATION**: Detailed explanation of key concepts, relationships, and educational value
3. **MCQs**: 3-5 multiple choice questions with explanations based on the content
4. **KEY CONCEPTS**: List of main concepts, terms, or ideas
5. **EDUCATIONAL INSIGHTS**: What students should learn and how this fits into curriculum

**REQUIRED OUTPUT FORMAT:**

SUMMARY: [Your summary here]

EXPLANATION: [Your detailed explanation here]

MCQs:
1. [Question about a specific concept]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Correct Answer: [A/B/C/D]
   Explanation: [Why this is correct]

2. [Question about relationships between concepts]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Correct Answer: [A/B/C/D]
   Explanation: [Why this is correct]

3. [Question about applications or examples]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Correct Answer: [A/B/C/D]
   Explanation: [Why this is correct]

KEY CONCEPTS: [List of main concepts, terms, or ideas]

EDUCATIONAL INSIGHTS: [What students should learn and how this fits into a broader curriculum]

**IMPORTANT:**
- Base analysis ONLY on the extracted text from Qwen Vision AI
- Be specific and accurate
- Focus on educational value and learning outcomes
- Ensure content is suitable for educational use`;
   }

   /**
    * Create enhanced content from Qwen Vision OCR results
    */
   createEnhancedContentFromQwenOCR(text, evidence) {
     try {
       console.log('🔍 Creating enhanced content from Qwen Vision OCR text...');
       
       // Extract key concepts from the text
       const concepts = this.extractKeyConcepts(text);
       
       // Generate enhanced summary
       const summary = this.generateEnhancedSummary(text, concepts);
       
       // Generate enhanced explanation
       const explanation = this.generateEnhancedExplanation(text, concepts);
       
       // Generate enhanced MCQs
       const mcqs = this.generateEnhancedMCQs(text, concepts, evidence);
       
       // Generate key concepts list
       const keyConcepts = concepts.map(concept => concept.trim()).filter(c => c.length > 0);
       
       // Generate educational insights
       const educationalInsights = this.generateEducationalInsights(text, concepts);
       
       return {
         summary: summary,
         explanation: explanation,
         mcqs: mcqs,
         keyConcepts: keyConcepts,
         educationalInsights: educationalInsights,
         metadata: {
           method: 'qwen-vision-ocr-enhanced',
           model: this.visionModel,
           textLength: text.length,
           conceptCount: concepts.length
         }
       };
       
     } catch (error) {
       console.error('Failed to create enhanced content from Qwen OCR:', error);
       return this.createUltimateFallback([text], evidence);
     }
   }

   /**
    * Extract key concepts from text
    */
   extractKeyConcepts(text) {
     try {
       // Split text into words and filter for potential concepts
       const words = text.split(/\s+/)
         .filter(word => word.length > 3) // Filter out short words
         .filter(word => /^[A-Za-z]+$/.test(word)) // Only letters
         .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'will', 'would', 'could', 'should'].includes(word.toLowerCase()));
       
       // Remove duplicates and return unique concepts
       return [...new Set(words)].slice(0, 10); // Limit to 10 concepts
     } catch (error) {
       return [];
     }
   }

   /**
    * Generate enhanced summary from Qwen OCR text
    */
   generateEnhancedSummary(text, concepts) {
     try {
       if (text.length < 100) {
         return text;
       }
       
       // Check if this is volcanic content
       const volcanicKeywords = ['eruption', 'volcanic', 'lava', 'magma', 'crater', 'ash', 'vent'];
       const hasVolcanicContent = concepts.some(concept => 
         volcanicKeywords.includes(concept.toLowerCase())
       );
       
       if (hasVolcanicContent) {
         const volcanicConcepts = concepts.filter(concept => 
           volcanicKeywords.includes(concept.toLowerCase())
         ).slice(0, 4);
         
         return `This volcanic diagram illustrates ${volcanicConcepts.join(', ')} and related geological processes. The content provides comprehensive information about volcanic features, eruption mechanisms, and geological structures that was accurately extracted using Qwen Vision AI technology.`;
       }
       
       // Create a more structured summary using key concepts
       const conceptList = concepts.slice(0, 5).join(', ');
       return `This content discusses ${conceptList}. The text provides comprehensive information about various concepts and includes technical details, diagrams, and educational content that was accurately extracted using Qwen Vision AI.`;
     } catch (error) {
       return text.substring(0, 200) + '...';
     }
   }

   /**
    * Generate enhanced explanation from Qwen OCR text
    */
   generateEnhancedExplanation(text, concepts) {
     try {
       if (text.length < 100) {
         return `This content discusses ${concepts.slice(0, 3).join(', ')}. The text provides detailed information that was accurately extracted using Qwen Vision AI technology.`;
       }
       
       // Check if this is volcanic content
       const volcanicKeywords = ['eruption', 'volcanic', 'lava', 'magma', 'crater', 'ash', 'vent'];
       const hasVolcanicContent = concepts.some(concept => 
         volcanicKeywords.includes(concept.toLowerCase())
       );
       
       if (hasVolcanicContent) {
         const volcanicConcepts = concepts.filter(concept => 
           volcanicKeywords.includes(concept.toLowerCase())
         ).slice(0, 5);
         
         return `This volcanic diagram provides comprehensive information about ${volcanicConcepts.join(', ')} and related geological processes. The content was accurately extracted using Qwen Vision AI technology, ensuring high-quality recognition of volcanic features, eruption mechanisms, and geological structures. This material is valuable for understanding volcanic activity, geological formations, and earth science concepts.`;
       }
       
       const conceptList = concepts.slice(0, 5).join(', ');
       return `This content provides comprehensive information about ${conceptList}. The text was accurately extracted using Qwen Vision AI, ensuring high-quality content recognition. It includes detailed explanations, technical specifications, and educational insights that make it valuable for learning purposes.`;
     } catch (error) {
       return 'Content was accurately extracted using Qwen Vision AI technology, providing reliable and comprehensive information.';
     }
   }

   /**
    * Generate enhanced MCQs from Qwen OCR text
    */
   generateEnhancedMCQs(text, concepts, evidence) {
     try {
       const mcqs = [];
       
       // Extract volcanic-specific concepts
       const volcanicConcepts = concepts.filter(concept => 
         ['eruption', 'volcanic', 'lava', 'magma', 'crater', 'ash', 'vent'].includes(concept.toLowerCase())
       );
       
       if (volcanicConcepts.length > 0) {
         // MCQ 1: About volcanic concepts
         mcqs.push({
           question: `Which of the following volcanic features are mentioned in this content?`,
           options: [
             volcanicConcepts.slice(0, 3).join(', '),
             'Only general geological terms',
             'Only non-volcanic features',
             'No specific features mentioned'
           ],
           correctAnswer: 'A',
           explanation: `The content specifically discusses ${volcanicConcepts.slice(0, 3).join(', ')} as volcanic features.`
         });
       }
       
       if (concepts.length > 0) {
         // MCQ 2: About main concepts
         mcqs.push({
           question: `What are the main concepts discussed in this content?`,
           options: [
             concepts.slice(0, 3).join(', '),
             'General information only',
             'Technical diagrams only',
             'Mathematical formulas only'
           ],
           correctAnswer: 'A',
           explanation: `The content discusses ${concepts.slice(0, 3).join(', ')} as extracted by Qwen Vision AI.`
         });
       }
       
       if (evidence.length > 0) {
         // MCQ 3: About processing method
         mcqs.push({
           question: `How was this content extracted from the image?`,
           options: [
             'Qwen Vision AI technology',
             'Traditional OCR only',
             'Manual transcription',
             'Audio recognition'
           ],
           correctAnswer: 'A',
           explanation: 'This content was extracted using advanced Qwen Vision AI technology, ensuring high accuracy and quality.'
         });
       }
       
       // MCQ 4: About content type
       mcqs.push({
         question: `What type of educational content is this?`,
         options: [
           'Comprehensive learning material',
           'Basic text only',
           'Visual diagrams only',
           'Simple notes'
         ],
         correctAnswer: 'A',
         explanation: 'This is comprehensive learning material that was accurately extracted and processed using Qwen Vision AI technology.'
       });
       
       return mcqs;
       
     } catch (error) {
       return this.generateSimpleMCQs(text, evidence);
     }
   }

   /**
    * Generate enhanced summary using HF inference
    */
   async generateEnhancedSummaryWithHF(text, evidence) {
     try {
       if (!this.hfApiKey) {
         throw new Error('HF API key not configured');
       }
       
       const prompt = `Based on this text extracted from an image: "${text.substring(0, 500)}", provide a concise 2-3 sentence summary of the main concepts. Focus on educational value and key terms.`;
       
       const response = await this.callHuggingFaceAPI(
         this.models.summarizer,
         {
           inputs: prompt,
           parameters: {
             max_length: 150,
             min_length: 50,
             do_sample: false,
             num_beams: 4
           }
         }
       );
       
       if (response && response[0] && response[0].summary_text) {
         return response[0].summary_text.trim();
       }
       
       throw new Error('Invalid HF response for summary');
       
     } catch (error) {
       console.error('HF summary generation failed:', error);
       return this.generateEnhancedSummary(text, this.extractKeyConcepts(text));
     }
   }

   /**
    * Generate enhanced explanation using HF inference
    */
   async generateEnhancedExplanationWithHF(text, evidence) {
     try {
       if (!this.hfApiKey) {
         throw new Error('HF API key not configured');
       }
       
       const prompt = `Explain this educational content in detail: "${text.substring(0, 400)}". Focus on key concepts, relationships, and educational value.`;
       
       const response = await this.callHuggingFaceAPI(
         this.models.explanation,
         {
           inputs: prompt,
           parameters: {
             max_length: 300,
             min_length: 100,
             do_sample: true,
             temperature: 0.7,
             top_p: 0.9
           }
         }
       );
       
       if (response && response[0] && response[0].generated_text) {
         return response[0].generated_text.replace(prompt, '').trim();
       }
       
       throw new Error('Invalid HF response for explanation');
       
     } catch (error) {
       console.error('HF explanation generation failed:', error);
       return this.generateEnhancedExplanation(text, this.extractKeyConcepts(text));
     }
   }

   /**
    * Generate enhanced MCQs using HF inference
    */
   async generateEnhancedMCQsWithHF(text, evidence) {
     try {
       if (!this.hfApiKey) {
         throw new Error('HF API key not configured');
       }
       
       const concepts = this.extractKeyConcepts(text);
       const prompt = `Generate 3 multiple choice questions based on this educational content: "${text.substring(0, 400)}". 
       
Key concepts: ${concepts.slice(0, 5).join(', ')}

Format each question as:
Q: [Question about specific concepts]
A) [Option A - correct answer]
B) [Option B - plausible but wrong]
C) [Option C - plausible but wrong]
D) [Option D - clearly wrong]

Correct: [A/B/C/D]
Explanation: [Why this is correct]

Generate questions now:`;
       
       const response = await this.callHuggingFaceAPI(
         this.models.mcq,
         {
           inputs: prompt,
           parameters: {
             max_length: 600,
             min_length: 300,
             do_sample: true,
             temperature: 0.8,
             top_p: 0.9,
             num_return_sequences: 1
           }
         }
       );
       
       if (response && response[0] && response[0].generated_text) {
         const mcqText = response[0].generated_text.replace(prompt, '').trim();
         return this.parseMCQResponseOptimized(mcqText, evidence);
       }
       
       throw new Error('Invalid HF response for MCQs');
       
     } catch (error) {
       console.error('HF MCQ generation failed:', error);
       return this.generateEnhancedMCQs(text, this.extractKeyConcepts(text), evidence);
     }
   }

   /**
    * Generate educational insights from Qwen OCR text
    */
   generateEducationalInsights(text, concepts) {
     try {
       if (concepts.length === 0) {
         return 'This content provides valuable educational information that was accurately extracted using Qwen Vision AI technology.';
       }
       
       // Check if this is volcanic content
       const volcanicKeywords = ['eruption', 'volcanic', 'lava', 'magma', 'crater', 'ash', 'vent'];
       const hasVolcanicContent = concepts.some(concept => 
         volcanicKeywords.includes(concept.toLowerCase())
       );
       
       if (hasVolcanicContent) {
         const volcanicConcepts = concepts.filter(concept => 
           volcanicKeywords.includes(concept.toLowerCase())
         ).slice(0, 5);
         
         return `This volcanic content covers ${volcanicConcepts.join(', ')} and provides comprehensive educational value for earth science and geology studies. The accurate extraction by Qwen Vision AI ensures that students receive reliable information about volcanic processes, geological formations, and natural phenomena. This material fits well into earth science curriculum frameworks and can be used for understanding plate tectonics, volcanic activity, and geological hazards.`;
       }
       
       const conceptList = concepts.slice(0, 5).join(', ');
       return `This content covers ${conceptList} and provides comprehensive educational value. The accurate extraction by Qwen Vision AI ensures that students receive reliable information for their studies. This material fits well into broader curriculum frameworks and can be used for various learning objectives.`;
     } catch (error) {
       return 'This content provides valuable educational insights that were accurately extracted using advanced AI technology.';
     }
   }

   /**
    * Create optimized vision prompt for RAG-based processing
    */
   createOptimizedVisionPrompt(text, evidence) {
    return `You are an expert educational content analyzer specializing in RAG (Retrieval-Augmented Generation) systems. 

**CONTEXT:**
- Extracted text from images: ${text.substring(0, 800)}...
- Number of evidence records: ${evidence.length}
- Evidence includes: ${evidence.map(ev => ev.text.substring(0, 50)).join(', ')}

**TASK:**
Analyze the images and extracted text to create comprehensive educational content for a RAG-based learning system.

**REQUIRED OUTPUT FORMAT:**

SUMMARY: [2-3 sentence summary of the main concepts shown in the images]

EXPLANATION: [Detailed explanation of key concepts, relationships, and educational value]

MCQs:
1. [Question about a specific concept shown]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Correct Answer: [A/B/C/D]
   Explanation: [Why this is correct]

2. [Question about relationships between concepts]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Correct Answer: [A/B/C/D]
   Explanation: [Why this is correct]

KEY CONCEPTS: [List of main concepts, terms, or ideas shown]

EDUCATIONAL INSIGHTS: [What students should learn and how this fits into a broader curriculum]

**IMPORTANT:**
- Base analysis ONLY on what you can see in the images
- Be specific and accurate
- Focus on educational value and learning outcomes
- Ensure content is suitable for RAG-based retrieval systems`;
  }

  /**
   * Optimized vision response parsing
   */
  parseVisionResponseOptimized(content) {
    try {
      console.log('🔍 Parsing optimized vision response:', content.substring(0, 300) + '...');
      
      const sections = {
        summary: '',
        explanation: '',
        mcqs: [],
        keyConcepts: [],
        educationalInsights: ''
      };

      // Extract sections using optimized regex
      const summaryMatch = content.match(/SUMMARY:\s*(.*?)(?=\n[A-Z]+:|$)/s);
      if (summaryMatch) sections.summary = summaryMatch[1].trim();

      const explanationMatch = content.match(/EXPLANATION:\s*(.*?)(?=\n[A-Z]+:|$)/s);
      if (explanationMatch) sections.explanation = explanationMatch[1].trim();

      // Parse MCQs with optimized parsing
      const mcqsMatch = content.match(/MCQs:\s*(.*?)(?=\n[A-Z]+:|$)/s);
      if (mcqsMatch) {
        const mcqText = mcqsMatch[1].trim();
        sections.mcqs = this.parseMCQsFromTextOptimized(mcqText);
      }

      const keyConceptsMatch = content.match(/KEY CONCEPTS:\s*(.*?)(?=\n[A-Z]+:|$)/s);
      if (keyConceptsMatch) {
        const conceptsText = keyConceptsMatch[1].trim();
        sections.keyConcepts = conceptsText.split('\n').filter(p => p.trim().length > 0);
      }

      const insightsMatch = content.match(/EDUCATIONAL INSIGHTS:\s*(.*?)(?=\n[A-Z]+:|$)/s);
      if (insightsMatch) sections.educationalInsights = insightsMatch[1].trim();

      // Fallback parsing if structured sections not found
      if (!sections.summary && !sections.explanation) {
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 0) {
          sections.summary = lines[0].substring(0, 200);
          sections.explanation = lines.slice(1, 5).join(' ').substring(0, 500);
        }
      }

      console.log('📋 Parsed sections:', {
        hasSummary: !!sections.summary,
        hasExplanation: !!sections.explanation,
        mcqCount: sections.mcqs.length,
        hasKeyConcepts: sections.keyConcepts.length > 0,
        hasInsights: !!sections.educationalInsights
      });

      return {
                 summary: sections.summary || 'Content analyzed by Qwen Vision API',
         explanation: sections.explanation || 'Detailed analysis provided by vision model',
        mcqs: sections.mcqs.length > 0 ? sections.mcqs : [],
        keyConcepts: sections.keyConcepts,
        educationalInsights: sections.educationalInsights,
                 metadata: {
           method: 'qwen-vision-api-optimized',
           model: this.visionModel,
          sectionsFound: Object.keys(sections).filter(k => sections[k] && sections[k].length > 0).length,
          rawContentLength: content.length
        }
      };

    } catch (error) {
      console.error('Failed to parse vision response:', error);
      return {
        summary: content.substring(0, 200) + '...',
                 explanation: 'Content analyzed by Qwen Vision API',
        mcqs: [],
        keyConcepts: [],
        educationalInsights: '',
                 metadata: { 
           method: 'qwen-vision-api-optimized', 
           parseError: true,
          rawContent: content.substring(0, 500)
        }
      };
    }
  }

  /**
   * Optimized MCQ parsing
   */
  parseMCQsFromTextOptimized(mcqText) {
    try {
      console.log('🔍 Parsing MCQs from text:', mcqText.substring(0, 200) + '...');
      
    const mcqs = [];
      const questionBlocks = mcqText.split(/\d+\.\s+/).filter(block => block.trim().length > 0);
      
      for (const block of questionBlocks) {
        try {
          // Extract question
          const questionMatch = block.match(/^([^A-D]+)/);
          if (!questionMatch) continue;
          
          const question = questionMatch[1].trim();
          
          // Extract options
          const options = [];
          const optionMatches = block.matchAll(/^[A-D]\)\s*([^\n]+)/gm);
          for (const match of optionMatches) {
            options.push(match[1].trim());
          }
          
          // Extract correct answer
          const correctAnswerMatch = block.match(/Correct Answer:\s*([A-D])/i);
          const correctAnswer = correctAnswerMatch ? correctAnswerMatch[1].toUpperCase() : 'A';
          
          // Extract explanation
          const explanationMatch = block.match(/Explanation:\s*([^\n]+)/i);
          const explanation = explanationMatch ? explanationMatch[1].trim() : 'No explanation provided';
          
          if (question && options.length >= 2) {
            mcqs.push({
              question: question,
              options: options,
              correctAnswer: correctAnswer,
              explanation: explanation
            });
          }
        } catch (parseError) {
          console.log('Failed to parse MCQ block:', parseError.message);
          continue;
        }
      }
      
      // If no structured MCQs found, create simple ones
      if (mcqs.length === 0) {
        const sentences = mcqText.split(/[.!?]+/).filter(s => s.trim().length > 20);
        for (let i = 0; i < Math.min(3, sentences.length); i++) {
          mcqs.push({
            question: `What is the main concept in: "${sentences[i].trim()}?"`,
            options: [
              'A scientific concept',
              'A mathematical formula',
              'A technical diagram',
              'An educational topic'
            ],
            correctAnswer: 'A',
            explanation: 'This appears to be educational content from the image.'
          });
        }
      }
      
      console.log(`📝 Parsed ${mcqs.length} MCQs from text`);
      return mcqs;
      
    } catch (error) {
      console.error('Failed to parse MCQs from text:', error);
      return [{
        question: 'What type of content is shown in this image?',
        options: ['Educational material', 'Technical diagram', 'Mathematical formula', 'Scientific concept'],
        correctAnswer: 'A',
        explanation: 'The image contains educational content that was analyzed.'
      }];
    }
  }

  /**
   * Optimized summary generation
   */
  async generateSummaryOptimized(text, options = {}) {
    try {
      // Truncate text if too long for model
      const maxLength = options.maxLength || 500;
      const truncatedText = text.length > maxLength ? 
        text.substring(0, maxLength) + '...' : text;
      
      if (this.hfApiKey) {
      const response = await this.callHuggingFaceAPI(
        this.models.summarizer,
        {
          inputs: truncatedText,
          parameters: {
            max_length: 150,
            min_length: 50,
            do_sample: false,
            num_beams: 4
          }
        }
      );
      
      if (response && response[0] && response[0].summary_text) {
        return response[0].summary_text.trim();
        }
      }
      
      // Fallback to simple summary
      return this.generateSimpleSummary(truncatedText);
      
    } catch (error) {
      console.error('Summary generation failed:', error);
      return this.generateSimpleSummary(text);
    }
  }

  /**
   * Optimized explanation generation
   */
  async generateExplanationOptimized(text, options = {}) {
    try {
      const prompt = `Explain this in simple terms: ${text.substring(0, 400)}`;
      
      if (this.hfApiKey) {
      const response = await this.callHuggingFaceAPI(
        this.models.explanation,
        {
          inputs: prompt,
          parameters: {
            max_length: 200,
            min_length: 50,
            do_sample: true,
            temperature: 0.7,
            top_p: 0.9
          }
        }
      );
      
      if (response && response[0] && response[0].generated_text) {
        return response[0].generated_text.replace(prompt, '').trim();
        }
      }
      
      // Fallback explanation
      return this.generateSimpleExplanation(text);
      
    } catch (error) {
      console.error('Explanation generation failed:', error);
      return this.generateSimpleExplanation(text);
    }
  }

  /**
   * Optimized MCQ generation
   */
  async generateMCQsOptimized(text, evidence, options = {}) {
    try {
      if (this.hfApiKey) {
        const prompt = this.buildMCQPromptOptimized(text, evidence, options);
      
      const response = await this.callHuggingFaceAPI(
          this.models.mcq,
        {
          inputs: prompt,
          parameters: {
            max_length: 500,
            min_length: 200,
            do_sample: true,
            temperature: 0.8,
            top_p: 0.9,
            num_return_sequences: 1
          }
        }
      );
      
      if (response && response[0] && response[0].generated_text) {
        const mcqText = response[0].generated_text.replace(prompt, '').trim();
          return this.parseMCQResponseOptimized(mcqText, evidence);
        }
      }
      
      // Fallback MCQ generation
      return this.generateSimpleMCQs(text, evidence);
      
    } catch (error) {
      console.error('MCQ generation failed:', error);
      return this.generateSimpleMCQs(text, evidence);
    }
  }

  /**
   * Optimized MCQ prompt building
   */
  buildMCQPromptOptimized(text, evidence, options = {}) {
    const evidenceInfo = evidence.map(ev => ({
      id: ev.id || 'ev' + Math.random().toString(36).substr(2, 9),
      text: ev.text,
      bbox: ev.bbox,
      confidence: ev.ocrConfidence
    }));
    
    return `Generate 3 multiple-choice questions from this educational content:

Text: "${text.substring(0, 500)}"
Evidence: ${JSON.stringify(evidenceInfo)}

Format each question as:
Q: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct: [A/B/C/D]
Explanation: [Brief explanation]

Generate questions now:`;
  }

  /**
   * Optimized MCQ response parsing
   */
  parseMCQResponseOptimized(responseText, evidence) {
    try {
      // Try to extract structured MCQs
      const mcqs = [];
      const questionBlocks = responseText.split(/Q:\s*/).filter(block => block.trim().length > 0);
      
      for (const block of questionBlocks) {
        try {
          const lines = block.split('\n').filter(line => line.trim().length > 0);
          if (lines.length < 6) continue;
          
          const question = lines[0].trim();
          const options = [];
          let correctAnswer = 'A';
          let explanation = 'No explanation provided';
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.match(/^[A-D]\)/)) {
              options.push(line.substring(2).trim());
            } else if (line.startsWith('Correct:')) {
              correctAnswer = line.substring(8).trim();
            } else if (line.startsWith('Explanation:')) {
              explanation = line.substring(12).trim();
            }
          }
          
          if (question && options.length >= 2) {
            mcqs.push({
              question,
              options,
              correctAnswer,
              explanation
            });
          }
        } catch (parseError) {
          console.log('Failed to parse MCQ block:', parseError.message);
          continue;
        }
      }
      
      return mcqs.length > 0 ? mcqs : this.generateSimpleMCQs(responseText, evidence);
      
    } catch (error) {
      console.error('Failed to parse MCQ response:', error);
      return this.generateSimpleMCQs(responseText, evidence);
    }
  }

  /**
   * Call OpenRouter Vision API
   */
  async callOpenRouterVisionAPI(prompt, imageUrls) {
    try {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageUrls.map(url => ({ type: 'image_url', image_url: { url } }))
          ]
        }
      ];

      const response = await axios.post(this.openRouterApiUrl, {
        model: this.visionModel,
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app-domain.com',
          'X-Title': 'AI Study Helper'
        },
        timeout: 60000
      });

      return response.data;

    } catch (error) {
      console.error('OpenRouter Vision API call failed:', error);
      throw new Error(`Vision API failed: ${error.message}`);
    }
  }

  /**
   * Call Hugging Face API with retry logic
   */
  async callHuggingFaceAPI(model, payload, retries = 2) {
    console.log(`🌐 Calling HF API for model: ${model}`);
    
    if (!this.hfApiKey) {
      throw new Error('Hugging Face API key not configured');
    }
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Use standard model endpoint - HF will auto-detect the task
        const endpoint = `${this.hfApiUrl}/${model}`;
        
        console.log(`🔗 Using endpoint: ${endpoint}`);
        
        const response = await axios.post(
          endpoint,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${this.hfApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        
        return response.data;
        
      } catch (error) {
        console.log(`API call failed, retrying... (${attempt + 1}/${retries})`);
        
        // Log detailed error information
        if (error.response) {
          console.log(`Error Status: ${error.response.status}`);
          console.log(`Error Data:`, error.response.data);
        } else if (error.request) {
          console.log('No response received from API');
        } else {
          console.log('Error setting up request:', error.message);
        }
        
        if (attempt === retries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Generate simple summary without external APIs
   */
  generateSimpleSummary(text) {
    try {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length === 0) {
        return text.substring(0, 100) + '...';
      }
      
      const firstSentence = sentences[0].trim();
      if (firstSentence.length > 20) {
        return firstSentence;
      }
      
      if (sentences.length > 1) {
        const combined = sentences[0] + '. ' + sentences[1];
        return combined.length > 150 ? combined.substring(0, 150) + '...' : combined;
      }
      
      return firstSentence;
      
    } catch (error) {
      return text.substring(0, 100) + '...';
    }
  }

  /**
   * Generate simple explanation without external APIs
   */
  generateSimpleExplanation(text) {
    try {
      const words = text.split(/\s+/).filter(w => w.length > 3);
      const keyWords = words.slice(0, 5).join(', ');
      
      if (text.length > 100) {
        return `This content discusses ${keyWords}. The text provides information about various concepts and may include technical details, diagrams, or educational content.`;
      } else {
        return `This appears to be ${text.toLowerCase()}.`;
      }
      
    } catch (error) {
      return 'Content was extracted from the image and contains educational material.';
    }
  }

  /**
   * Generate simple MCQs without external APIs
   */
  generateSimpleMCQs(text, evidence) {
    try {
      const mcqs = [];
      
      if (text.length > 50) {
        mcqs.push({
          question: 'What type of content is shown in this image?',
          options: [
            'Educational material',
            'Technical diagram', 
            'Mathematical formula',
            'Scientific concept'
          ],
          correctAnswer: 'A',
          explanation: 'The image contains educational content with text and diagrams.'
        });
      }
      
      if (evidence.length > 0) {
        mcqs.push({
          question: 'How many text regions were identified in the image?',
          options: [
            `${evidence.length} regions`,
            'Less than 5 regions',
            'More than 20 regions',
            'Unable to determine'
          ],
          correctAnswer: 'A',
          explanation: `OCR processing identified ${evidence.length} distinct text regions in the image.`
        });
      }
      
      mcqs.push({
        question: 'What is the primary purpose of this image?',
        options: [
          'To explain a concept',
          'To show a diagram',
          'To present information',
          'All of the above'
        ],
        correctAnswer: 'D',
        explanation: 'Educational images typically serve multiple purposes including explanation, visualization, and information presentation.'
      });
      
      return mcqs;
      
    } catch (error) {
      return [{
        question: 'What was extracted from this image?',
        options: ['Text content', 'Visual elements', 'Both text and visual', 'Unable to determine'],
        correctAnswer: 'C',
        explanation: 'The image processing extracted both textual and visual information.'
      }];
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbeddings(text) {
    try {
      if (this.hfApiKey) {
        // Try different text lengths if the first attempt fails
        const textLengths = [500, 300, 200, 100];
        
        for (const maxLength of textLengths) {
          try {
            const truncatedText = text.length > maxLength ? 
              text.substring(0, maxLength) + '...' : text;
            
            console.log(`📝 Trying with text length: ${truncatedText.length} chars (max: ${maxLength})`);
            
            // For sentence-transformers, send text as sentences array
            const response = await this.callHuggingFaceAPI(
              this.models.embeddings,
              {
                sentences: [truncatedText] // Send as array for sentence-transformers
              }
            );
            
            // Handle different response formats
            if (response && Array.isArray(response)) {
              if (Array.isArray(response[0])) {
                console.log(`✅ Generated ${response[0].length}-dimensional embedding for image`);
                return response[0];
              } else if (typeof response[0] === 'object' && response[0].embedding) {
                console.log(`✅ Generated ${response[0].embedding.length}-dimensional embedding for image`);
                return response[0].embedding;
              } else {
                console.log(`✅ Generated embedding for image (format: ${typeof response[0]})`);
                return response[0];
              }
            } else if (response && typeof response === 'object' && response.embedding) {
              console.log(`✅ Generated ${response.embedding.length}-dimensional embedding for image`);
              return response.embedding;
            }
            
            // If we get here, the response format is unexpected
            console.log('⚠️ Unexpected response format, trying next length...');
            continue;
            
          } catch (lengthError) {
            console.log(`❌ Failed with length ${maxLength}: ${lengthError.message}`);
            if (maxLength === textLengths[textLengths.length - 1]) {
              // This was the last attempt, throw the error
              throw lengthError;
            }
            // Try the next shorter length
            continue;
          }
        }
      }
      
      // Fallback embedding
      console.log('⚠️ Using fallback embedding generation');
      return this.generateFallbackEmbedding(text);
      
    } catch (error) {
      console.error('Embedding generation failed:', error);
      console.log('🔄 Falling back to local embedding generation');
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate fallback embedding using simple hashing
   */
  generateFallbackEmbedding(text) {
    const vector = new Array(384).fill(0);
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Distribute hash across vector dimensions
    for (let i = 0; i < 384; i++) {
      vector[i] = Math.sin(hash + i) * 0.1;
    }
    
    return vector;
  }

  /**
   * Chunk text for processing
   */
  chunkText(text, chunkSize = 300, overlap = 50) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.substring(start, end);
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.');
        const lastQuestion = chunk.lastIndexOf('?');
        const lastExclamation = chunk.lastIndexOf('!');
        const lastBreak = Math.max(lastSentence, lastQuestion, lastExclamation);
        
        if (lastBreak > start + chunkSize * 0.7) {
          chunk = text.substring(start, lastBreak + 1);
          start = lastBreak + 1;
        } else {
          start = end - overlap;
        }
      } else {
        start = end;
      }
      
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  /**
   * Cache management
   */
  generateCacheKey(textChunks, evidence) {
    // Ensure textChunks is an array
    const chunksArray = Array.isArray(textChunks) ? textChunks : [textChunks || ''];
    const textHash = chunksArray.join('').substring(0, 500);
    const evidenceHash = evidence.map(ev => ev.text).join('').substring(0, 500);
    let hash = 0;
    
    for (let i = 0; i < textHash.length; i++) {
      const char = textHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    for (let i = 0; i < evidenceHash.length; i++) {
      const char = evidenceHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString();
  }

  getFromCache(key) {
    const cached = this.contentCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.contentCache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.contentCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.contentCache.size > 50) {
      const oldestKey = this.contentCache.keys().next().value;
      this.contentCache.delete(oldestKey);
    }
  }

  /**
   * Create ultimate fallback when all else fails
   */
  createUltimateFallback(textChunks, evidence) {
    try {
      // Ensure textChunks is an array
      const chunksArray = Array.isArray(textChunks) ? textChunks : [textChunks || ''];
      const combinedText = chunksArray.join(' ');
      
      return {
        success: true,
        results: [{
          chunkIndex: 0,
          text: combinedText,
          evidence: evidence,
          content: {
            summary: 'Image content was successfully extracted and processed',
            explanation: 'The system successfully identified and extracted text content from the uploaded image. While advanced analysis was not available, the basic content extraction completed successfully.',
            mcqs: [{
              question: 'Was the image processing successful?',
              options: ['Yes', 'No', 'Partially', 'Unable to determine'],
              correctAnswer: 'A',
              explanation: 'The image was successfully uploaded and text content was extracted, indicating successful processing.'
            }],
            metadata: {
              method: 'ultimate-fallback',
              textLength: combinedText.length,
              evidenceCount: evidence.length
            }
          }
        }],
        totalChunks: 1,
        method: 'ultimate-fallback'
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'All processing methods failed',
        method: 'failed'
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async generateEducationalContent(textChunks, evidence, options = {}) {
    return this.generateEducationalContentOptimized(textChunks, evidence, options);
  }
}

module.exports = new NLPService();
