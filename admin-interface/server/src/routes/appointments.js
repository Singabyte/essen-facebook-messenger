const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection-pg');

// Get all appointments
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        a.*,
        u.name as user_name,
        u.profile_pic
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (startDate) {
      params.push(startDate);
      query += ` AND a.appointment_date >= $${++paramCount}`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND a.appointment_date <= $${++paramCount}`;
    }
    
    // Get total count
    const countQuery = query.replace(
      'SELECT a.*, u.name as user_name, u.profile_pic',
      'SELECT COUNT(*) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);
    
    // Get paginated results
    query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      appointments: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments', error: error.message });
  }
});

// Get appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        a.*,
        u.name as user_name,
        u.profile_pic
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    res.json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Error fetching appointment', error: error.message });
  }
});

// Update appointment status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updateQuery = `
      UPDATE appointments 
      SET status = $1 
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    res.json({ message: 'Status updated', appointment: result.rows[0] });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Error updating appointment', error: error.message });
  }
});

module.exports = router;