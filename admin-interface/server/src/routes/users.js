const express = require('express');
const router = express.Router();
const queries = require('../db/queries-pg');
const authMiddleware = require('../middleware/auth');

// Get all users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await queries.users.getAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      search: search || undefined
    });
    
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

// Toggle bot status for a user
router.put('/:id/bot-status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const adminId = req.user?.id || 'admin'; // Get admin ID from JWT token
    
    const updatedUser = await queries.users.toggleBotStatus(id, enabled, adminId);
    
    // Emit WebSocket event for real-time updates
    if (req.io) {
      req.io.to('admins').emit('bot-status-changed', {
        userId: id,
        botEnabled: enabled,
        adminTakeover: !enabled,
        adminId
      });
    }
    
    res.json({ 
      success: true,
      user: updatedUser,
      message: `Bot ${enabled ? 'enabled' : 'disabled'} for user`
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating bot status', error: error.message });
  }
});

// Send message to user from admin
router.post('/:id/send-message', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.user?.id || 'admin';
    
    // Get user details for Facebook ID
    const user = await queries.users.getById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Send message via Facebook API
    const axios = require('axios');
    const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';
    
    try {
      await axios.post(
        `${FACEBOOK_API_URL}/me/messages`,
        {
          recipient: { id: user.id }, // Facebook user ID
          message: { text: message }
        },
        { 
          params: { 
            access_token: process.env.PAGE_ACCESS_TOKEN 
          } 
        }
      );
      
      // Save message to database
      const savedMessage = await queries.conversations.saveAdminMessage(
        id,
        '', // No user message in this case
        message,
        adminId
      );
      
      // Emit WebSocket event for real-time updates
      if (req.io) {
        req.io.to(`user-${id}`).emit('new-message', {
          userId: id,
          message: savedMessage,
          isAdmin: true
        });
        
        req.io.to('admins').emit('admin-message-sent', {
          userId: id,
          message: savedMessage
        });
      }
      
      res.json({ 
        success: true,
        message: 'Message sent successfully',
        conversation: savedMessage
      });
    } catch (fbError) {
      console.error('Facebook API error:', fbError.response?.data || fbError.message);
      res.status(500).json({ 
        message: 'Failed to send message via Facebook',
        error: fbError.response?.data?.error?.message || fbError.message
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
});

// Get real-time conversation for a user
router.get('/:id/real-time-conversation', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    const conversations = await queries.conversations.getRealTimeConversation(id, limit);
    
    res.json({ 
      success: true,
      conversations,
      total: conversations.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching real-time conversation', error: error.message });
  }
});

module.exports = router;