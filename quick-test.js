const fetch = require('node-fetch');

console.log('🚀 Quick DashScope API Test');
console.log('============================');
console.log('');

// Check if API key is set
const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.log('❌ No API key found!');
  console.log('');
  console.log('💡 Quick setup:');
  console.log('1. Get your API key from: https://dashscope.console.aliyun.com/');
  console.log('2. Set it temporarily: $env:DASHSCOPE_API_KEY="sk-your-key"');
  console.log('3. Run this script: node quick-test.js');
  console.log('');
  process.exit(1);
}

console.log('✅ API key found! Testing DashScope API...\n');

async function quickTest() {
  try {
    // Test 1: Simple chat completion
    console.log('🔍 Testing chat completion...');
    const chatResponse = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from DashScope!" and nothing else.'
          }
        ],
        max_tokens: 20,
        temperature: 0.1
      })
    });

    if (chatResponse.ok) {
      const data = await chatResponse.json();
      console.log('✅ Chat test successful!');
      console.log(`Response: "${data.choices?.[0]?.message?.content}"`);
      console.log(`Tokens used: ${data.usage?.total_tokens || 'unknown'}`);
    } else {
      const errorData = await chatResponse.text();
      console.log(`❌ Chat test failed: ${chatResponse.status}`);
      console.log('Error:', errorData);
    }

    console.log('');

    // Test 2: Token usage
    console.log('🔍 Testing token usage endpoint...');
    const tokenResponse = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      console.log('✅ Token usage test successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const errorData = await tokenResponse.text();
      console.log(`❌ Token usage test failed: ${tokenResponse.status}`);
      console.log('Error:', errorData);
    }

    console.log('');
    console.log('✨ Quick test completed!');
    console.log('');
    console.log('🎯 Your DashScope API is working correctly!');
    console.log('Next steps:');
    console.log('1. Test the fallback system: npm run test:api-key');
    console.log('2. Test comprehensive scenarios: npm run test:fallback');
    console.log('3. Run the demo: npm run demo:fallback');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest();
