const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const KB_DIR = path.join(__dirname, '../../../../');
const KB_FILES = {
  main: 'essen-chatbot-kb.md',
  examples: 'essen-chatbot-sg-examples.md'
};

// Get knowledge base files
router.get('/files', async (req, res) => {
  try {
    const files = Object.entries(KB_FILES).map(([key, filename]) => ({
      id: key,
      name: filename,
      path: path.join(KB_DIR, filename)
    }));
    res.json({ files });
  } catch (error) {
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