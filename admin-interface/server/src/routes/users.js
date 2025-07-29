const express = require('express');
const router = express.Router();
const queries = require('../db/queries');
const authMiddleware = require('../middleware/auth');

// Get all users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    let result;
    if (search) {
      const users = await queries.users.search(search, limit);
      result = { users, total: users.length };
    } else {
      result = await queries.users.getAll(limit, offset);
    }
    
    res.json({ 
      ...result,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await queries.users.getById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
});

// Get user conversations
router.get('/:id/conversations', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await queries.conversations.getAll({
      userId: id,
      limit,
      offset
    });
    
    res.json({ 
      ...result,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

module.exports = router;