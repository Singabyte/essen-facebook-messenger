const fs = require('fs');
const path = require('path');

// Script to ensure knowledge base files are accessible to admin API
const files = ['essen-chatbot-kb.md', 'essen-chatbot-sg-examples.md'];

console.log('Copying knowledge base files for admin API...');
console.log('Current directory:', process.cwd());

// Try to find the files in various locations
const possibleSourceDirs = [
  path.join(__dirname, '../../..'),  // Root of the project
  path.join(__dirname, '../../../..'),  // One level up
  '/workspace',  // DigitalOcean workspace root
  process.cwd()  // Current working directory
];

files.forEach(file => {
  let copied = false;
  
  for (const sourceDir of possibleSourceDirs) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(process.cwd(), file);
    
    try {
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied ${file} from ${sourcePath} to ${destPath}`);
        copied = true;
        break;
      }
    } catch (error) {
      // Continue trying other paths
    }
  }
  
  if (!copied) {
    console.error(`✗ Could not find ${file} in any of the expected locations`);
    console.error('Searched in:', possibleSourceDirs);
  }
});

console.log('Knowledge base files copy complete.');