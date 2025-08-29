const dashscopeService = require('./src/services/dashscopeService');
const fs = require('fs');
const path = require('path');

console.log('🔄 Complete OCR Workflow Demo for PDFs and Images');
console.log('==================================================');
console.log('');

async function demonstrateOCRWorkflow() {
  console.log('📋 Workflow Overview:');
  console.log('1. Image OCR: Primary OCR → DashScope Fallback');
  console.log('2. PDF OCR: PDF-Parse → DashScope Fallback (if needed)');
  console.log('3. Token Limiting: Smart resource management');
  console.log('4. Rate Limiting: API abuse prevention');
  console.log('5. Error Handling: Graceful degradation');
  console.log('');

  // Check service status
  console.log('🔍 Service Status Check:');
  const status = dashscopeService.getStatus();
  console.log(`   Available: ${status.available ? '✅ Yes' : '❌ No'}`);
  console.log(`   API Key Valid: ${status.apiKeyValid ? '✅ Yes' : '❌ No'}`);
  console.log(`   Token Limits: ${status.tokenLimits.min}-${status.tokenLimits.max} tokens`);
  console.log(`   Rate Limit: ${status.rateLimiting.requestsPerMinute} requests/minute`);
  console.log('');

  if (!status.available || !status.apiKeyValid) {
    console.log('❌ Service not available. Please check your API key configuration.');
    return;
  }

  // Demo 1: Image OCR Workflow
  console.log('🖼️  Demo 1: Image OCR Workflow');
  console.log('--------------------------------');
  await demonstrateImageOCRWorkflow();

  console.log('');

  // Demo 2: PDF OCR Workflow
  console.log('📄 Demo 2: PDF OCR Workflow');
  console.log('------------------------------');
  await demonstratePDFOCRWorkflow();

  console.log('');

  // Demo 3: Token Limiting Workflow
  console.log('🔒 Demo 3: Token Limiting Workflow');
  console.log('-----------------------------------');
  await demonstrateTokenLimitingWorkflow();

  console.log('');

  // Demo 4: Rate Limiting Workflow
  console.log('⏱️  Demo 4: Rate Limiting Workflow');
  console.log('------------------------------------');
  await demonstrateRateLimitingWorkflow();

  console.log('✨ OCR Workflow Demo Completed!');
}

async function demonstrateImageOCRWorkflow() {
  console.log('   📊 Image OCR Processing Flow:');
  console.log('   1. Upload image file');
  console.log('   2. Try primary OCR service (Tesseract, TROCR, etc.)');
  console.log('   3. If primary fails → Use DashScope fallback');
  console.log('   4. Process results with token limiting');
  console.log('   5. Generate evidence records');
  console.log('');

  // Simulate primary OCR failure
  console.log('   🔄 Simulating primary OCR failure...');
  const mockPrimaryOCRResult = { success: false, error: 'Primary OCR service unavailable' };
  
  if (!mockPrimaryOCRResult.success) {
    console.log('   🚨 Primary OCR failed, activating DashScope fallback...');
    
    // Create a simple test image (text-based for demo)
    const testImageBuffer = createTestImageBuffer();
    
    try {
      const fallbackResult = await dashscopeService.processImageOCR(testImageBuffer, {
        prompt: "Extract all text content from this image",
        maxTokens: 500,
        temperature: 0.1
      });

      if (fallbackResult.success) {
        console.log('   ✅ DashScope fallback successful!');
        console.log(`   Method: ${fallbackResult.method}`);
        console.log(`   Evidence count: ${fallbackResult.totalRegions}`);
        console.log(`   Confidence: ${fallbackResult.averageConfidence}`);
        console.log(`   Extracted text: ${fallbackResult.extractedText?.substring(0, 100)}...`);
      } else {
        console.log(`   ❌ Fallback also failed: ${fallbackResult.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Fallback error: ${error.message}`);
    }
  }
}

async function demonstratePDFOCRWorkflow() {
  console.log('   📊 PDF OCR Processing Flow:');
  console.log('   1. Upload PDF file');
  console.log('   2. Try PDF-Parse service (text extraction)');
  console.log('   3. If PDF-Parse fails → Use DashScope fallback');
  console.log('   4. Process extracted text with AI analysis');
  console.log('   5. Generate structured evidence records');
  console.log('');

  // Simulate PDF processing
  console.log('   🔄 Simulating PDF processing...');
  
  try {
    // First, try PDF-Parse (primary method)
    console.log('   📄 Trying PDF-Parse service...');
    const pdfParseResult = await simulatePDFParse();
    
    if (pdfParseResult.success) {
      console.log('   ✅ PDF-Parse successful!');
      console.log(`   Extracted text length: ${pdfParseResult.text.length} characters`);
      console.log(`   Pages: ${pdfParseResult.pages}`);
      
      // Now use DashScope to analyze the extracted text
      console.log('   🤖 Using DashScope to analyze extracted text...');
      const analysisResult = await dashscopeService.processRAG(
        "Summarize the key points from this document",
        [{ text: pdfParseResult.text.substring(0, 1000) }], // First 1000 chars
        null,
        { maxTokens: 300, temperature: 0.3 }
      );
      
      if (analysisResult.success) {
        console.log('   ✅ Text analysis successful!');
        console.log(`   Summary: ${analysisResult.response.substring(0, 150)}...`);
      }
    } else {
      console.log('   ❌ PDF-Parse failed, trying DashScope fallback...');
      const fallbackResult = await dashscopeService.processPDFFallback(
        Buffer.from('PDF content would be here'),
        { maxTokens: 500 }
      );
      console.log(`   Fallback result: ${fallbackResult.success ? 'Success' : 'Failed'}`);
    }
  } catch (error) {
    console.log(`   ❌ PDF processing error: ${error.message}`);
  }
}

async function demonstrateTokenLimitingWorkflow() {
  console.log('   📊 Token Limiting Workflow:');
  console.log('   1. User requests OCR with specific token limit');
  console.log('   2. System validates and normalizes token limits');
  console.log('   3. Applies limits to API calls');
  console.log('   4. Monitors usage and costs');
  console.log('');

  const testCases = [
    { maxTokens: 50, description: 'Quick OCR' },
    { maxTokens: 200, description: 'Standard OCR' },
    { maxTokens: 500, description: 'Detailed OCR' },
    { maxTokens: 1000, description: 'Comprehensive OCR' }
  ];

  for (const testCase of testCases) {
    console.log(`   🔍 Testing ${testCase.description} (${testCase.maxTokens} tokens)...`);
    
    try {
      const result = await dashscopeService.processRAG(
        "Extract key information from this text",
        [{ text: "Sample text for testing token limiting functionality." }],
        null,
        { maxTokens: testCase.maxTokens, temperature: 0.5 }
      );

      if (result.success) {
        console.log(`   ✅ ${testCase.description} successful`);
        console.log(`   Response length: ${result.response.length} characters`);
        console.log(`   Tokens used: ${result.usage?.total_tokens || 'unknown'}`);
      } else {
        console.log(`   ❌ ${testCase.description} failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ ${testCase.description} error: ${error.message}`);
    }
    console.log('');
  }
}

async function demonstrateRateLimitingWorkflow() {
  console.log('   📊 Rate Limiting Workflow:');
  console.log('   1. Monitor request frequency');
  console.log('   2. Apply rate limits (60 requests/minute)');
  console.log('   3. Queue requests when limit exceeded');
  console.log('   4. Automatic reset after 1 minute');
  console.log('');

  console.log('   🔄 Testing rate limiting with multiple requests...');
  
  const promises = [];
  for (let i = 0; i < 8; i++) {
    promises.push(
      dashscopeService.processRAG(
        `Rate limit test query ${i + 1}`,
        [{ text: "Test context for rate limiting." }],
        null,
        { maxTokens: 50 }
      )
    );
  }

  try {
    const results = await Promise.all(promises);
    let successCount = 0;
    let rateLimitCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (result.success) {
        successCount++;
      } else if (result.error?.includes('Rate limit')) {
        rateLimitCount++;
      } else {
        errorCount++;
      }
    });

    console.log(`   ✅ Rate limiting test completed`);
    console.log(`   Successful requests: ${successCount}`);
    console.log(`   Rate limited requests: ${rateLimitCount}`);
    console.log(`   Other errors: ${errorCount}`);
    console.log(`   Current rate limit status: ${dashscopeService.getStatus().rateLimiting.currentRequests}/${dashscopeService.getStatus().rateLimiting.requestsPerMinute}`);
  } catch (error) {
    console.log(`   ❌ Rate limiting test error: ${error.message}`);
  }
}

// Helper function to create a test image buffer
function createTestImageBuffer() {
  // Create a minimal valid PNG buffer (20x20 pixels)
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x14,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xCF, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
}

// Simulate PDF-Parse service
async function simulatePDFParse() {
  // Simulate successful PDF parsing
  return {
    success: true,
    text: "This is a sample PDF document containing important information about artificial intelligence and machine learning. The document discusses various algorithms, neural networks, and their applications in modern technology. It covers topics such as deep learning, natural language processing, computer vision, and reinforcement learning. The content is structured to provide both theoretical foundations and practical examples for students and researchers in the field.",
    pages: 3,
    metadata: {
      title: "AI and Machine Learning Overview",
      author: "Sample Author",
      subject: "Artificial Intelligence"
    }
  };
}

// Run the demo
demonstrateOCRWorkflow().catch(console.error);
