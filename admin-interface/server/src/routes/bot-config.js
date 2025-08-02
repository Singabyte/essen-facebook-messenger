const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/connection');

// Get all bot configuration settings
router.get('/', async (req, res) => {
  try {
    const configs = await all(`
      SELECT * FROM bot_config 
      ORDER BY category, key_name
    `);
    
    // Group configurations by category
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = [];
      }
      acc[config.category].push({
        ...config,
        value: config.data_type === 'json' ? JSON.parse(config.value || '{}') : config.value
      });
      return acc;
    }, {});
    
    res.json({
      configs: groupedConfigs,
      categories: Object.keys(groupedConfigs)
    });
  } catch (error) {
    console.error('Error fetching bot config:', error);
    res.status(500).json({ message: 'Error fetching bot configuration', error: error.message });
  }
});

// Get configuration by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    const config = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key]
    );
    
    if (!config) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    
    // Parse JSON values if needed
    if (config.data_type === 'json') {
      config.value = JSON.parse(config.value || '{}');
    }
    
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ message: 'Error fetching configuration', error: error.message });
  }
});

// Update configuration
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    // Check if config exists
    const existingConfig = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key]
    );
    
    if (!existingConfig) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    
    // Validate and convert value based on data type
    let processedValue = value;
    
    if (existingConfig.data_type === 'number') {
      processedValue = parseFloat(value);
      if (isNaN(processedValue)) {
        return res.status(400).json({ message: 'Invalid number value' });
      }
      processedValue = processedValue.toString();
    } else if (existingConfig.data_type === 'boolean') {
      processedValue = value ? '1' : '0';
    } else if (existingConfig.data_type === 'json') {
      try {
        JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
        processedValue = typeof value === 'string' ? value : JSON.stringify(value);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON value' });
      }
    }
    
    await run(`
      UPDATE bot_config SET
        value = ?,
        description = COALESCE(?, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE key_name = ?
    `, [processedValue, description, key]);
    
    const updatedConfig = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key]
    );
    
    // Parse JSON values for response
    if (updatedConfig.data_type === 'json') {
      updatedConfig.value = JSON.parse(updatedConfig.value || '{}');
    }
    
    res.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ message: 'Error updating configuration', error: error.message });
  }
});

// Create new configuration
router.post('/', async (req, res) => {
  try {
    const {
      key_name,
      value,
      data_type = 'string',
      category = 'general',
      description,
      is_public = false
    } = req.body;
    
    if (!key_name || value === undefined) {
      return res.status(400).json({ message: 'Key name and value are required' });
    }
    
    // Check if key already exists
    const existingConfig = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key_name]
    );
    
    if (existingConfig) {
      return res.status(409).json({ message: 'Configuration key already exists' });
    }
    
    // Validate and convert value based on data type
    let processedValue = value;
    
    if (data_type === 'number') {
      processedValue = parseFloat(value);
      if (isNaN(processedValue)) {
        return res.status(400).json({ message: 'Invalid number value' });
      }
      processedValue = processedValue.toString();
    } else if (data_type === 'boolean') {
      processedValue = value ? '1' : '0';
    } else if (data_type === 'json') {
      try {
        JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
        processedValue = typeof value === 'string' ? value : JSON.stringify(value);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON value' });
      }
    }
    
    await run(`
      INSERT INTO bot_config (key_name, value, data_type, category, description, is_public)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [key_name, processedValue, data_type, category, description, is_public ? 1 : 0]);
    
    const newConfig = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key_name]
    );
    
    // Parse JSON values for response
    if (newConfig.data_type === 'json') {
      newConfig.value = JSON.parse(newConfig.value || '{}');
    }
    
    res.status(201).json({
      message: 'Configuration created successfully',
      config: newConfig
    });
  } catch (error) {
    console.error('Error creating config:', error);
    res.status(500).json({ message: 'Error creating configuration', error: error.message });
  }
});

// Delete configuration
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    const config = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key]
    );
    
    if (!config) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    
    await run('DELETE FROM bot_config WHERE key_name = ?', [key]);
    
    res.json({
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(500).json({ message: 'Error deleting configuration', error: error.message });
  }
});

// Reset configuration to default
router.post('/:key/reset', async (req, res) => {
  try {
    const { key } = req.params;
    
    const config = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key]
    );
    
    if (!config) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    
    if (!config.default_value) {
      return res.status(400).json({ message: 'No default value available for this configuration' });
    }
    
    await run(`
      UPDATE bot_config SET
        value = default_value,
        updated_at = CURRENT_TIMESTAMP
      WHERE key_name = ?
    `, [key]);
    
    const resetConfig = await get(
      'SELECT * FROM bot_config WHERE key_name = ?',
      [key]
    );
    
    // Parse JSON values for response
    if (resetConfig.data_type === 'json') {
      resetConfig.value = JSON.parse(resetConfig.value || '{}');
    }
    
    res.json({
      message: 'Configuration reset to default successfully',
      config: resetConfig
    });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ message: 'Error resetting configuration', error: error.message });
  }
});

// Get configuration history
router.get('/:key/history', async (req, res) => {
  try {
    const { key } = req.params;
    const { limit = 10 } = req.query;
    
    // Note: This would require a config_history table to be implemented
    // For now, return empty array
    res.json({
      key,
      history: [],
      message: 'Configuration history feature not yet implemented'
    });
  } catch (error) {
    console.error('Error fetching config history:', error);
    res.status(500).json({ message: 'Error fetching configuration history', error: error.message });
  }
});

// Bulk update configurations
router.put('/', async (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({ message: 'Configs must be an array' });
    }
    
    const results = [];
    const errors = [];
    
    for (const config of configs) {
      try {
        const { key_name, value, description } = config;
        
        // Check if config exists
        const existingConfig = await get(
          'SELECT * FROM bot_config WHERE key_name = ?',
          [key_name]
        );
        
        if (!existingConfig) {
          errors.push({ key: key_name, error: 'Configuration not found' });
          continue;
        }
        
        // Validate and convert value based on data type
        let processedValue = value;
        
        if (existingConfig.data_type === 'number') {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            errors.push({ key: key_name, error: 'Invalid number value' });
            continue;
          }
          processedValue = processedValue.toString();
        } else if (existingConfig.data_type === 'boolean') {
          processedValue = value ? '1' : '0';
        } else if (existingConfig.data_type === 'json') {
          try {
            JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
            processedValue = typeof value === 'string' ? value : JSON.stringify(value);
          } catch (e) {
            errors.push({ key: key_name, error: 'Invalid JSON value' });
            continue;
          }
        }
        
        await run(`
          UPDATE bot_config SET
            value = ?,
            description = COALESCE(?, description),
            updated_at = CURRENT_TIMESTAMP
          WHERE key_name = ?
        `, [processedValue, description, key_name]);
        
        results.push({ key: key_name, status: 'updated' });
        
      } catch (error) {
        errors.push({ key: config.key_name, error: error.message });
      }
    }
    
    res.json({
      message: 'Bulk update completed',
      updated: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ message: 'Error in bulk update', error: error.message });
  }
});

module.exports = router;