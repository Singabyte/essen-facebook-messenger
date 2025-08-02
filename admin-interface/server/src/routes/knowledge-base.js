const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Use different path resolution based on environment
const KB_DIR = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), '../..') // In production, admin server runs from admin-interface/server
  : path.join(__dirname, '../../../../'); // In development, use relative path

console.log('Knowledge Base Directory:', KB_DIR);
console.log('Current working directory:', process.cwd());

const KB_FILES = {
  main: 'essen-chatbot-kb.md',
  examples: 'essen-chatbot-sg-examples.md'
};

// Get knowledge base files
router.get('/files', async (req, res) => {
  try {
    // Check if files exist
    const files = [];
    for (const [key, filename] of Object.entries(KB_FILES)) {
      const filePath = path.join(KB_DIR, filename);
      try {
        await fs.access(filePath);
        files.push({
          id: key,
          name: filename,
          path: filePath,
          exists: true
        });
      } catch {
        console.error(`File not found: ${filePath}`);
        files.push({
          id: key,
          name: filename,
          path: filePath,
          exists: false
        });
      }
    }
    
    console.log('Knowledge base files:', files);
    res.json({ files });
  } catch (error) {
    console.error('Error in /files endpoint:', error);
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
});

// Get file content
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filename = KB_FILES[id];
    
    if (!filename) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const filePath = path.join(KB_DIR, filename);
    console.log(`Attempting to read file: ${filePath}`);
    
    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch {
      console.error(`File not found: ${filePath}`);
      console.error('Directory contents:', await fs.readdir(KB_DIR));
      return res.status(404).json({ 
        message: 'File not found', 
        path: filePath,
        directory: KB_DIR 
      });
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    res.json({
      id,
      filename,
      content,
      lastModified: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error reading file', error: error.message });
  }
});

// Update file content
router.put('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const filename = KB_FILES[id];
    
    if (!filename) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const filePath = path.join(KB_DIR, filename);
    
    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    const originalContent = await fs.readFile(filePath, 'utf-8');
    await fs.writeFile(backupPath, originalContent);
    
    // Write new content
    await fs.writeFile(filePath, content, 'utf-8');
    
    res.json({
      message: 'File updated successfully',
      backup: backupPath
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating file', error: error.message });
  }
});

// Get file history
router.get('/files/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Implement version history
    res.json({ history: [] });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
});

module.exports = router;