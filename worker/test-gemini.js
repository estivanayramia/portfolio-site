// Quick test script to check Gemini API
const API_KEY = process.env.GEMINI_API_KEY ?? 'TEST_KEY_NOT_SET';

async function testGemini() {
  // First, list available models
  console.log('=== Listing Available Models ===');
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const listResp = await fetch(listUrl);
    const listData = await listResp.json();
    if (listData.models) {
      console.log('Available models:');
      listData.models.forEach(m => {
        if (m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')) {
          console.log(`  - ${m.name}`);
        }
      });
    }
  } catch (err) {
    console.log('Failed to list models:', err.message);
  }
  
  console.log('\n=== Testing Models ===');
  const models = [
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-flash-002',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-pro-latest',
    'models/gemini-1.5-pro',
    'models/gemini-pro',
    'gemini-1.5-flash'
  ];
  
  for (const model of models) {
    console.log(`\n=== Testing: ${model} ===`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${API_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Say hello in 5 words' }]
          }]
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ SUCCESS!');
        console.log('Response:', data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data).slice(0, 100));
        break; // Found working model
      } else {
        console.log(`❌ Failed (${response.status}):`, JSON.stringify(data).slice(0, 200));
      }
    } catch (err) {
      console.log('❌ Error:', err.message);
    }
  }
}

testGemini();
