/**
 * Test script to validate chatbot accuracy against site-facts
 * Tests that worker never invents projects and treats Whispers correctly as a hobby
 */

const WORKER_URL = 'https://portfolio-chat.eayramia.workers.dev/chat';
const TEST_ORIGIN = 'https://estivanayramia.com';

const tests = [
  {
    name: "List projects - should only return real projects from site-facts",
    message: "List your projects",
    expect: {
      shouldContain: [
        "projects/",  // Should link to /projects/
        "L'Oréal", "Franklin Templeton", "Endpoint"  // Real project names
      ],
      shouldNotContain: [
        "getWispers", "get Wispers", "Whispers App", "messaging app", "discipline system"
      ]
    }
  },
  {
    name: "Tell me about Whispers - should describe as hobby (sticky notes)",
    message: "Tell me about Whispers",
    expect: {
      shouldContain: [
        "hobby", "hobbies", "sticky notes", "hobbies/whispers"
      ],
      shouldNotContain: [
        "project", "app", "application", "messaging", "getWispers"
      ]
    }
  },
  {
    name: "Tell me about getWispers - should say not listed",
    message: "Tell me about getWispers",
    expect: {
      shouldContain: [
        "not listed", "projects/", "/projects/"
      ],
      shouldNotContain: [
        "anonymous", "ethics", "messaging", "app"
      ]
    }
  },
  {
    name: "What hobbies do you have - should include Whispers (Sticky Notes)",
    message: "What hobbies do you have",
    expect: {
      shouldContain: [
        "Whispers", "Sticky Notes", "Gym", "Photography", "Reading"
      ],
      shouldNotContain: [
        "getWispers", "project"
      ]
    }
  },
  {
    name: "Show me your work - should link to /projects/ not /projects.html",
    message: "Show me your work",
    expect: {
      shouldContain: [
        "/projects/"
      ],
      shouldNotContain: [
        "/projects.html", "getWispers", "Whispers App"
      ]
    }
  }
];

async function runTest(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`   Message: "${test.message}"`);
  
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': TEST_ORIGIN
      },
      body: JSON.stringify({ message: test.message })
    });
    
    if (!response.ok) {
      console.log(`   ❌ FAIL: HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    const reply = data.reply || '';
    const replyLower = reply.toLowerCase();
    
    // Check shouldContain
    const missingItems = [];
    for (const item of test.expect.shouldContain) {
      if (!replyLower.includes(item.toLowerCase())) {
        missingItems.push(item);
      }
    }
    
    // Check shouldNotContain
    const unexpectedItems = [];
    for (const item of test.expect.shouldNotContain) {
      if (replyLower.includes(item.toLowerCase())) {
        unexpectedItems.push(item);
      }
    }
    
    // Determine pass/fail
    const passed = missingItems.length === 0 && unexpectedItems.length === 0;
    
    if (passed) {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ❌ FAIL`);
      if (missingItems.length > 0) {
        console.log(`      Missing expected: ${missingItems.join(', ')}`);
      }
      if (unexpectedItems.length > 0) {
        console.log(`      Found unexpected: ${unexpectedItems.join(', ')}`);
      }
    }
    
    console.log(`   📝 Reply: ${reply.substring(0, 150)}...`);
    console.log(`   💬 Chips: ${JSON.stringify(data.chips)}`);
    
    return passed;
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting chatbot accuracy tests...\n');
  console.log(`   Worker URL: ${WORKER_URL}`);
  console.log(`   Origin: ${TEST_ORIGIN}`);
  
  const results = [];
  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ name: test.name, passed });
    
    // Wait a bit between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });
  
  console.log('\n' + '-'.repeat(80));
  console.log(`Total: ${passedCount}/${totalCount} passed`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 All tests passed! Chatbot is accurate.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalCount - passedCount} test(s) failed. Review output above.`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
