const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/connection');

// Get all FAQs
router.get('/', async (req, res) => {
  try {
    const { category, search, is_active, limit = 20, offset = 0 } = req.query;
    
    let sql = `SELECT 
      f.*,
      COUNT(fu.id) as usage_count
      FROM faqs f
      LEFT JOIN faq_usage fu ON f.id = fu.faq_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (category && category !== 'all') {
      conditions.push('f.category = ?');
      params.push(category);
    }
    
    if (search) {
      conditions.push('(f.question LIKE ? OR f.answer LIKE ? OR f.keywords LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (is_active !== undefined) {
      conditions.push('f.is_active = ?');
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY f.id ORDER BY f.sort_order ASC, f.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const faqs = await all(sql, params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as count FROM faqs f';
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    const total = await get(countSql, params.slice(0, -2));
    
    // Get categories
    const categories = await all(
      'SELECT DISTINCT category FROM faqs WHERE category IS NOT NULL ORDER BY category'
    );
    
    res.json({
      faqs,
      total: total.count,
      categories: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ message: 'Error fetching FAQs', error: error.message });
  }
});

// Get single FAQ by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const faq = await get(`
      SELECT f.*, 
        COUNT(fu.id) as usage_count,
        MAX(fu.asked_at) as last_asked
      FROM faqs f
      LEFT JOIN faq_usage fu ON f.id = fu.faq_id
      WHERE f.id = ?
      GROUP BY f.id
    `, [id]);
    
    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }
    
    // Parse keywords
    if (faq.keywords) {
      try {
        faq.keywords = JSON.parse(faq.keywords);
      } catch (e) {
        faq.keywords = [];
      }
    }
    
    // Get usage history
    const usageHistory = await all(`
      SELECT fu.*, u.name as user_name
      FROM faq_usage fu
      LEFT JOIN users u ON fu.user_id = u.id
      WHERE fu.faq_id = ?
      ORDER BY fu.asked_at DESC
      LIMIT 10
    `, [id]);
    
    res.json({
      faq,
      usageHistory
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({ message: 'Error fetching FAQ', error: error.message });
  }
});

// Create new FAQ
router.post('/', async (req, res) => {
  try {
    const {
      question,
      answer,
      category,
      keywords = [],
      sort_order = 0,
      is_active = true
    } = req.body;
    
    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({ 
        message: 'Question and answer are required' 
      });
    }
    
    const result = await run(`
      INSERT INTO faqs (
        question, answer, category, keywords, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      question, answer, category,
      JSON.stringify(keywords),
      sort_order,
      is_active ? 1 : 0
    ]);
    
    const newFaq = await get(
      'SELECT * FROM faqs WHERE id = ?',
      [result.lastID]
    );
    
    // Parse keywords for response
    if (newFaq.keywords) {
      try {
        newFaq.keywords = JSON.parse(newFaq.keywords);
      } catch (e) {
        newFaq.keywords = [];
      }
    }
    
    res.status(201).json({
      message: 'FAQ created successfully',
      faq: newFaq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ message: 'Error creating FAQ', error: error.message });
  }
});

// Update FAQ
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question,
      answer,
      category,
      keywords,
      sort_order,
      is_active
    } = req.body;
    
    // Check if FAQ exists
    const existingFaq = await get(
      'SELECT * FROM faqs WHERE id = ?',
      [id]
    );
    
    if (!existingFaq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }
    
    await run(`
      UPDATE faqs SET
        question = ?, answer = ?, category = ?, keywords = ?,
        sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      question, answer, category,
      JSON.stringify(keywords || []),
      sort_order, is_active ? 1 : 0, id
    ]);
    
    const updatedFaq = await get(
      'SELECT * FROM faqs WHERE id = ?',
      [id]
    );
    
    // Parse keywords for response
    if (updatedFaq.keywords) {
      try {
        updatedFaq.keywords = JSON.parse(updatedFaq.keywords);
      } catch (e) {
        updatedFaq.keywords = [];
      }
    }
    
    res.json({
      message: 'FAQ updated successfully',
      faq: updatedFaq
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ message: 'Error updating FAQ', error: error.message });
  }
});

// Delete FAQ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if FAQ exists
    const faq = await get(
      'SELECT * FROM faqs WHERE id = ?',
      [id]
    );
    
    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }
    
    // Delete FAQ (usage history will be preserved)
    await run('DELETE FROM faqs WHERE id = ?', [id]);
    
    res.json({
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ message: 'Error deleting FAQ', error: error.message });
  }
});

// Search FAQs by keyword matching
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Search in question, answer, and keywords
    const faqs = await all(`
      SELECT *, 
        CASE 
          WHEN question LIKE ? THEN 3
          WHEN keywords LIKE ? THEN 2
          WHEN answer LIKE ? THEN 1
          ELSE 0
        END as relevance_score
      FROM faqs 
      WHERE is_active = 1 
        AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)
      ORDER BY relevance_score DESC, usage_count DESC
      LIMIT ?
    `, [
      `%${query}%`, `%${query}%`, `%${query}%`,
      `%${query}%`, `%${query}%`, `%${query}%`,
      limit
    ]);
    
    // Parse keywords for each FAQ
    const processedFaqs = faqs.map(faq => {
      if (faq.keywords) {
        try {
          faq.keywords = JSON.parse(faq.keywords);
        } catch (e) {
          faq.keywords = [];
        }
      }
      return faq;
    });
    
    res.json({
      query,
      results: processedFaqs,
      total: processedFaqs.length
    });
  } catch (error) {
    console.error('Error searching FAQs:', error);
    res.status(500).json({ message: 'Error searching FAQs', error: error.message });
  }
});

// Update FAQ order
router.put('/reorder', async (req, res) => {
  try {
    const { faqs } = req.body;
    
    if (!Array.isArray(faqs)) {
      return res.status(400).json({ message: 'FAQs must be an array' });
    }
    
    // Update sort order for each FAQ
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      await run(
        'UPDATE faqs SET sort_order = ? WHERE id = ?',
        [i, faq.id]
      );
    }
    
    res.json({
      message: 'FAQ order updated successfully',
      updated: faqs.length
    });
  } catch (error) {
    console.error('Error reordering FAQs:', error);
    res.status(500).json({ message: 'Error reordering FAQs', error: error.message });
  }
});

// Get FAQ analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;
    
    // Usage over time
    const usageOverTime = await all(`
      SELECT 
        DATE(asked_at) as date,
        COUNT(*) as usage_count
      FROM faq_usage 
      WHERE faq_id = ? 
        AND asked_at >= datetime('now', '-${parseInt(days)} days')
      GROUP BY DATE(asked_at)
      ORDER BY date ASC
    `, [id]);
    
    // Total usage stats
    const totalUsage = await get(`
      SELECT 
        COUNT(*) as total_asks,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(asked_at) as last_asked,
        MIN(asked_at) as first_asked
      FROM faq_usage 
      WHERE faq_id = ?
    `, [id]);
    
    res.json({
      faq_id: id,
      usage_over_time: usageOverTime,
      total_stats: totalUsage
    });
  } catch (error) {
    console.error('Error fetching FAQ analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
});

// Get most asked questions analytics
router.get('/analytics/popular', async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;
    
    const popularFaqs = await all(`
      SELECT 
        f.*,
        COUNT(fu.id) as usage_count,
        MAX(fu.asked_at) as last_asked
      FROM faqs f
      LEFT JOIN faq_usage fu ON f.id = fu.faq_id
      WHERE fu.asked_at >= datetime('now', '-${parseInt(days)} days')
        OR fu.asked_at IS NULL
      GROUP BY f.id
      ORDER BY usage_count DESC, f.created_at DESC
      LIMIT ?
    `, [limit]);
    
    // Parse keywords for each FAQ
    const processedFaqs = popularFaqs.map(faq => {
      if (faq.keywords) {
        try {
          faq.keywords = JSON.parse(faq.keywords);
        } catch (e) {
          faq.keywords = [];
        }
      }
      return faq;
    });
    
    res.json({
      period_days: parseInt(days),
      popular_faqs: processedFaqs
    });
  } catch (error) {
    console.error('Error fetching popular FAQs:', error);
    res.status(500).json({ message: 'Error fetching popular FAQs', error: error.message });
  }
});

module.exports = router;