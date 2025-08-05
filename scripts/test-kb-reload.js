const { loadKnowledgeBase } = require('../src/geminiClient');

console.log('Testing Knowledge Base Reload...');
console.log('================================');

// Test initial load
console.log('1. Initial knowledge base status:');
console.log('   - Current time:', new Date().toLocaleString());

// Test reload function
console.log('\n2. Testing reload function...');
const result = loadKnowledgeBase();
console.log('   - Reload result:', result ? 'SUCCESS' : 'FAILED');

// Test that the knowledge base is accessible after reload
console.log('\n3. Verifying knowledge base content...');
const fs = require('fs');
const path = require('path');

try {
  const kbPath = path.join(process.cwd(), 'essen-chatbot-kb.md');
  const sgPath = path.join(process.cwd(), 'essen-chatbot-sg-examples.md');
  
  const kbExists = fs.existsSync(kbPath);
  const sgExists = fs.existsSync(sgPath);
  
  console.log('   - Main KB file exists:', kbExists);
  console.log('   - SG examples file exists:', sgExists);
  
  if (kbExists) {
    const kbSize = fs.statSync(kbPath).size;
    console.log('   - Main KB file size:', kbSize, 'bytes');
  }
  
  if (sgExists) {
    const sgSize = fs.statSync(sgPath).size;
    console.log('   - SG examples file size:', sgSize, 'bytes');
  }
} catch (error) {
  console.error('   - Error checking files:', error.message);
}

console.log('\n✅ Knowledge base reload test completed!');