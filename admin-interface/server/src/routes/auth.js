const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const queries = require('../db/queries');
const { logAudit } = require('../db/connection');
const authMiddleware = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Find user
    const user = await queries.admin.findByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Update last login
    await queries.admin.updateLastLogin(user.id);
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Log audit event
    await logAudit(user.id, 'LOGIN', 'auth', { username });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Register (for initial setup only)
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await queries.admin.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await queries.admin.createUser(username, hashedPassword);
    
    res.status(201).json({ 
      message: 'User created successfully',
      userId: result.id 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Validate token
router.get('/validate', authMiddleware, async (req, res) => {
  try {
    const user = await queries.admin.findByUsername(req.user.username);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error validating token', error: error.message });
  }
});

module.exports = router;