const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/connection');

// Get all promotion templates
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    
    let sql = `SELECT 
      t.*,
      COUNT(tu.id) as usage_count
      FROM promotion_templates t
      LEFT JOIN template_usage tu ON t.id = tu.template_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (category && category !== 'all') {
      conditions.push('t.category = ?');
      params.push(category);
    }
    
    if (search) {
      conditions.push('(t.name LIKE ? OR t.content LIKE ? OR t.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const templates = await all(sql, params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as count FROM promotion_templates t';
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    const total = await get(countSql, params.slice(0, -2));
    
    // Get categories
    const categories = await all(
      'SELECT DISTINCT category FROM promotion_templates ORDER BY category'
    );
    
    res.json({
      templates,
      total: total.count,
      categories: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
});

// Get single template by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await get(`
      SELECT t.*, 
        COUNT(tu.id) as usage_count,
        MAX(tu.used_at) as last_used
      FROM promotion_templates t
      LEFT JOIN template_usage tu ON t.id = tu.template_id
      WHERE t.id = ?
      GROUP BY t.id
    `, [id]);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Get usage history
    const usageHistory = await all(`
      SELECT tu.*, u.name as user_name
      FROM template_usage tu
      LEFT JOIN users u ON tu.user_id = u.id
      WHERE tu.template_id = ?
      ORDER BY tu.used_at DESC
      LIMIT 10
    `, [id]);
    
    res.json({
      template,
      usageHistory
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ message: 'Error fetching template', error: error.message });
  }
});

// Create new template
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      content,
      quick_replies,
      media_url,
      media_type,
      variables,
      trigger_keywords,
      is_active = true
    } = req.body;
    
    // Validate required fields
    if (!name || !content || !category) {
      return res.status(400).json({ 
        message: 'Name, content, and category are required' 
      });
    }
    
    const result = await run(`
      INSERT INTO promotion_templates (
        name, description, category, content, quick_replies, 
        media_url, media_type, variables, trigger_keywords, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, description, category, content,
      JSON.stringify(quick_replies || []),
      media_url, media_type,
      JSON.stringify(variables || []),
      JSON.stringify(trigger_keywords || []),
      is_active ? 1 : 0
    ]);
    
    const newTemplate = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json({
      message: 'Template created successfully',
      template: newTemplate
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: 'Error creating template', error: error.message });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      content,
      quick_replies,
      media_url,
      media_type,
      variables,
      trigger_keywords,
      is_active
    } = req.body;
    
    // Check if template exists
    const existingTemplate = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [id]
    );
    
    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    await run(`
      UPDATE promotion_templates SET
        name = ?, description = ?, category = ?, content = ?,
        quick_replies = ?, media_url = ?, media_type = ?,
        variables = ?, trigger_keywords = ?, is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, description, category, content,
      JSON.stringify(quick_replies || []),
      media_url, media_type,
      JSON.stringify(variables || []),
      JSON.stringify(trigger_keywords || []),
      is_active ? 1 : 0,
      id
    ]);
    
    const updatedTemplate = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [id]
    );
    
    res.json({
      message: 'Template updated successfully',
      template: updatedTemplate
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Error updating template', error: error.message });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if template exists
    const template = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [id]
    );
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Delete template (usage history will be preserved)
    await run('DELETE FROM promotion_templates WHERE id = ?', [id]);
    
    res.json({
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Error deleting template', error: error.message });
  }
});

// Test template (preview functionality)
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { variables: testVariables = {} } = req.body;
    
    const template = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [id]
    );
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Process template content with variables
    let processedContent = template.content;
    const templateVariables = JSON.parse(template.variables || '[]');
    
    templateVariables.forEach(variable => {
      const value = testVariables[variable.name] || variable.default_value || `{${variable.name}}`;
      processedContent = processedContent.replace(
        new RegExp(`{{${variable.name}}}`, 'g'),
        value
      );
    });
    
    // Parse quick replies
    let processedQuickReplies = [];
    try {
      const quickReplies = JSON.parse(template.quick_replies || '[]');
      processedQuickReplies = quickReplies.map(reply => ({
        ...reply,
        title: reply.title.replace(/{{(\w+)}}/g, (match, varName) => {
          return testVariables[varName] || reply.title;
        })
      }));
    } catch (e) {
      console.error('Error parsing quick replies:', e);
    }
    
    res.json({
      template_id: template.id,
      processed_content: processedContent,
      quick_replies: processedQuickReplies,
      media_url: template.media_url,
      media_type: template.media_type,
      variables_used: templateVariables,
      test_variables: testVariables
    });
  } catch (error) {
    console.error('Error testing template:', error);
    res.status(500).json({ message: 'Error testing template', error: error.message });
  }
});

// Duplicate template
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [id]
    );
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    const result = await run(`
      INSERT INTO promotion_templates (
        name, description, category, content, quick_replies,
        media_url, media_type, variables, trigger_keywords, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `${template.name} (Copy)`,
      template.description,
      template.category,
      template.content,
      template.quick_replies,
      template.media_url,
      template.media_type,
      template.variables,
      template.trigger_keywords,
      0 // Set duplicate as inactive by default
    ]);
    
    const newTemplate = await get(
      'SELECT * FROM promotion_templates WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json({
      message: 'Template duplicated successfully',
      template: newTemplate
    });
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ message: 'Error duplicating template', error: error.message });
  }
});

// Get template analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;
    
    // Usage over time
    const usageOverTime = await all(`
      SELECT 
        DATE(used_at) as date,
        COUNT(*) as usage_count
      FROM template_usage 
      WHERE template_id = ? 
        AND used_at >= datetime('now', '-${parseInt(days)} days')
      GROUP BY DATE(used_at)
      ORDER BY date ASC
    `, [id]);
    
    // Total usage stats
    const totalUsage = await get(`
      SELECT 
        COUNT(*) as total_uses,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(used_at) as last_used,
        MIN(used_at) as first_used
      FROM template_usage 
      WHERE template_id = ?
    `, [id]);
    
    res.json({
      template_id: id,
      usage_over_time: usageOverTime,
      total_stats: totalUsage
    });
  } catch (error) {
    console.error('Error fetching template analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
});

module.exports = router;