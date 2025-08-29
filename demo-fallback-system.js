const dashscopeService = require('./src/services/dashscopeService');

console.log('🎯 DashScope Fallback System Demo');
console.log('=================================');
console.log('');

async function demoFallbackSystem() {
  console.log('📋 Demo Scenarios:');
  console.log('1. No API key - Service gracefully handles missing configuration');
  console.log('2. Invalid API key - Service validates and reports issues');
  console.log('3. Valid API key - Full functionality with token limiting');
  console.log('4. Rate limiting - Automatic request throttling');
  console.log('5. Error handling - Graceful degradation');
  console.log('');

  // Scenario 1: No API key
  console.log('🔍 Scenario 1: No API Key');
  console.log('------------------------');
  await demoNoApiKey();
  console.log('');

  // Scenario 2: Invalid API key
  console.log('🔍 Scenario 2: Invalid API Key');
  console.log('-------------------------------');
  await demoInvalidApiKey();
  console.log('');

  // Scenario 3: Valid API key (if available)
  console.log('🔍 Scenario 3: Valid API Key (if configured)');
  console.log('---------------------------------------------');
  await demoValidApiKey();
  console.log('');

  // Scenario 4: Token limiting demo
  console.log('🔍 Scenario 4: Token Limiting Demo');
  console.log('----------------------------------');
  await demoTokenLimiting();
  console.log('');

  // Scenario 5: Integration demo
  console.log('🔍 Scenario 5: Integration Demo');
  console.log('--------------------------------');
  await demoIntegration();
  console.log('');

  console.log('✨ Demo completed!');
  console.log('');
  console.log('💡 Key Takeaways:');
  console.log('- Service works without API key (graceful degradation)');
  console.log('- Automatic token limiting and validation');
  console.log('- Rate limiting prevents API abuse');
  console.log('- Comprehensive error handling');
  console.log('- Easy integration with existing services');
}

async function demoNoApiKey() {
  // Remove any existing API key
  delete process.env.DASHSCOPE_API_KEY;
  
  const status = dashscopeService.getStatus();
  console.log(`   Service Available: ${status.available ? '✅ Yes' : '❌ No'}`);
  console.log(`   API Key Valid: ${status.apiKeyValid ? '✅ Yes' : '❌ No'}`);
  
  // Test OCR
  const ocrResult = await dashscopeService.processImageOCR(Buffer.from('test'), {});
  console.log(`   OCR Result: ${ocrResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!ocrResult.success) {
    console.log(`   Error: ${ocrResult.error}`);
  }
  
  // Test RAG
  const ragResult = await dashscopeService.processRAG("test query", [], null, {});
  console.log(`   RAG Result: ${ragResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!ragResult.success) {
    console.log(`   Error: ${ragResult.error}`);
  }
}

async function demoInvalidApiKey() {
  // Set invalid API key
  process.env.DASHSCOPE_API_KEY = 'invalid-key';
  
  const status = dashscopeService.getStatus();
  console.log(`   Service Available: ${status.available ? '✅ Yes' : '❌ No'}`);
  console.log(`   API Key Valid: ${status.apiKeyValid ? '✅ Yes' : '❌ No'}`);
  
  // Test OCR with invalid key
  const ocrResult = await dashscopeService.processImageOCR(Buffer.from('test'), {});
  console.log(`   OCR Result: ${ocrResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!ocrResult.success) {
    console.log(`   Error: ${ocrResult.error}`);
  }
}

async function demoValidApiKey() {
  // Check if we have a valid API key
  const status = dashscopeService.getStatus();
  
  if (status.available && status.apiKeyValid) {
    console.log('   ✅ Valid API key detected!');
    console.log(`   Token Limits: ${status.tokenLimits.min}-${status.tokenLimits.max} tokens`);
    console.log(`   Rate Limit: ${status.rateLimiting.requestsPerMinute} requests/minute`);
    
    // Test with valid key
    const testBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // Minimal PNG
    const result = await dashscopeService.processImageOCR(testBuffer, { maxTokens: 100 });
    console.log(`   Test Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
  } else {
    console.log('   ℹ️  No valid API key configured');
    console.log('   To test with real API key:');
    console.log('   DASHSCOPE_API_KEY=sk-your-key node demo-fallback-system.js');
  }
}

async function demoTokenLimiting() {
  console.log('   Testing token limit validation...');
  
  const testCases = [
    { maxTokens: -5, expected: 'normalized to minimum' },
    { maxTokens: 5, expected: 'normalized to minimum' },
    { maxTokens: 100, expected: 'accepted' },
    { maxTokens: 10000, expected: 'normalized to maximum' },
    { temperature: -1, expected: 'normalized to minimum' },
    { temperature: 5, expected: 'normalized to maximum' }
  ];
  
  for (const testCase of testCases) {
    const validated = dashscopeService.validateTokenLimits(testCase);
    console.log(`   ${JSON.stringify(testCase)} → ${JSON.stringify(validated)}`);
  }
}

async function demoIntegration() {
  console.log('   Testing integration with other services...');
  
  // Simulate OCR service fallback
  console.log('   Simulating OCR service fallback...');
  const mockOcrResult = { success: false, error: 'Primary OCR failed' };
  
  if (!mockOcrResult.success && dashscopeService.isAvailable()) {
    console.log('   🔄 Primary OCR failed, trying DashScope fallback...');
    const fallbackResult = await dashscopeService.processImageOCR(Buffer.from('test'), {});
    console.log(`   Fallback Result: ${fallbackResult.success ? '✅ Success' : '❌ Failed'}`);
  } else {
    console.log('   ℹ️  Primary OCR succeeded or fallback not available');
  }
  
  // Simulate RAG service fallback
  console.log('   Simulating RAG service fallback...');
  const mockRagResult = { success: false, error: 'Primary RAG failed' };
  
  if (!mockRagResult.success && dashscopeService.isAvailable()) {
    console.log('   🔄 Primary RAG failed, trying DashScope fallback...');
    const fallbackResult = await dashscopeService.processRAG("test query", [], null, {});
    console.log(`   Fallback Result: ${fallbackResult.success ? '✅ Success' : '❌ Failed'}`);
  } else {
    console.log('   ℹ️  Primary RAG succeeded or fallback not available');
  }
}

// Run the demo
demoFallbackSystem().catch(console.error);
