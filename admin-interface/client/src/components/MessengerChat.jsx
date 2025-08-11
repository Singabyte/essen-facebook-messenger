import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useSocket } from '../context/SocketContext';
import { usersAPI } from '../services/api';

function MessengerChat({ user, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [botEnabled, setBotEnabled] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const socket = useSocket();

  // Transform conversation data to handle combined message/response rows
  const transformConversations = (conversations) => {
    const transformed = [];
    
    conversations.forEach(conv => {
      // Add user message if exists
      if (conv.message && conv.message.trim()) {
        transformed.push({
          ...conv,
          id: `${conv.id}-user`,
          is_from_user: true,
          is_admin_message: false,
          display_text: conv.message,
          message_type: 'user'
        });
      }
      
      // Add bot/admin response if exists
      if (conv.response && conv.response.trim()) {
        transformed.push({
          ...conv,
          id: `${conv.id}-response`,
          is_from_user: false,
          is_admin_message: conv.is_admin_message || false,
          display_text: conv.response,
          message_type: conv.is_admin_message ? 'admin' : 'bot'
        });
      }
    });
    
    return transformed;
  };

  // Fetch conversation history
  useEffect(() => {
    fetchConversation();
    fetchBotStatus();
    
    // Join user room for real-time updates
    if (socket && user?.id) {
      socket.emit('join-user-room', user.id);
      
      // Listen for new messages
      socket.on('new-message', handleNewMessage);
      socket.on('admin-message', handleAdminMessage);
      socket.on('bot-status-changed', handleBotStatusChanged);
      
      return () => {
        socket.emit('leave-user-room', user.id);
        socket.off('new-message', handleNewMessage);
        socket.off('admin-message', handleAdminMessage);
        socket.off('bot-status-changed', handleBotStatusChanged);
      };
    }
  }, [user, socket]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await usersAPI.getRealTimeConversation(user.id);
      const conversations = response.data.conversations || [];
      // Transform conversations to separate user messages and bot responses
      const transformedMessages = transformConversations(conversations);
      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      setError('Failed to load conversation history');
    } finally {
      setLoading(false);
    }
  };

  const fetchBotStatus = async () => {
    if (!user) return;
    setBotEnabled(user.bot_enabled !== false);
  };

  const handleNewMessage = (data) => {
    if (data.userId === user.id) {
      setMessages(prev => [...prev, data.message]);
    }
  };

  const handleAdminMessage = (data) => {
    if (data.userId === user.id) {
      setMessages(prev => [...prev, {
        ...data.message,
        is_admin_message: true,
        admin_id: data.adminId
      }]);
    }
  };

  const handleBotStatusChanged = (data) => {
    if (data.userId === user.id) {
      setBotEnabled(data.botEnabled);
    }
  };

  const handleToggleBot = async () => {
    try {
      const newStatus = !botEnabled;
      await usersAPI.toggleBotStatus(user.id, newStatus);
      setBotEnabled(newStatus);
      
      // Show success message
      setError(null);
    } catch (error) {
      console.error('Error toggling bot status:', error);
      setError('Failed to toggle bot status');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setError(null);
    
    const tempMessage = {
      id: Date.now(),
      message: '',
      response: newMessage,
      timestamp: new Date().toISOString(),
      is_from_user: false,
      is_admin_message: true,
      admin_id: 'current_admin'
    };
    
    // Optimistically add message to UI
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    try {
      await usersAPI.sendMessage(user.id, newMessage);
      
      // Emit via socket for real-time sync
      if (socket) {
        socket.emit('send-message-to-user', {
          userId: user.id,
          message: newMessage
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(newMessage); // Restore message text
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessage = (msg, index) => {
    const isUserMessage = msg.is_from_user === true;
    const isAdminMessage = msg.is_admin_message === true;
    const isBotMessage = !isUserMessage && !isAdminMessage;
    // Use display_text if available (from transformation), otherwise fallback to original logic
    const messageText = msg.display_text || (isUserMessage ? msg.message : msg.response);

    return (
      <ListItem
        key={msg.id || index}
        sx={{
          flexDirection: isUserMessage ? 'row' : 'row-reverse',
          gap: 1,
          px: 1,
          py: 0.5
        }}
      >
        <ListItemAvatar sx={{ minWidth: 40 }}>
          <Avatar sx={{ width: 32, height: 32 }}>
            {isUserMessage ? (
              <PersonIcon fontSize="small" />
            ) : isAdminMessage ? (
              <AdminIcon fontSize="small" />
            ) : (
              <BotIcon fontSize="small" />
            )}
          </Avatar>
        </ListItemAvatar>
        
        <Box sx={{ maxWidth: '70%' }}>
          <Paper
            elevation={1}
            sx={{
              p: 1.5,
              bgcolor: isUserMessage ? 'primary.main' : isAdminMessage ? 'success.main' : 'grey.100',
              color: isUserMessage || isAdminMessage ? 'white' : 'text.primary',
              borderRadius: 2,
              borderTopLeftRadius: isUserMessage ? 2 : 0,
              borderTopRightRadius: isUserMessage ? 0 : 2
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {messageText}
            </Typography>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block', mt: 0.5 }}>
            {format(new Date(msg.timestamp || msg.created_at), 'MMM d, h:mm a')}
            {isAdminMessage && msg.admin_id && (
              <Chip
                label="Admin"
                size="small"
                color="success"
                sx={{ ml: 1, height: 16 }}
              />
            )}
          </Typography>
        </Box>
      </ListItem>
    );
  };

  return (
    <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar src={user?.profile_pic} sx={{ width: 40, height: 40 }}>
              {user?.name?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h6">{user?.name || 'Unknown User'}</Typography>
              <Typography variant="caption" color="text.secondary">
                User ID: {user?.id}
              </Typography>
            </Box>
          </Stack>
          
          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip title={botEnabled ? 'Bot will respond to messages' : 'Admin has taken over conversation'}>
              <FormControlLabel
                control={
                  <Switch
                    checked={botEnabled}
                    onChange={handleToggleBot}
                    color="primary"
                  />
                }
                label={botEnabled ? 'Bot Enabled' : 'Bot Disabled'}
                labelPlacement="start"
              />
            </Tooltip>
            <IconButton onClick={fetchConversation} size="small">
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Messages Area */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No messages yet. Start a conversation!
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {messages.map((msg, index) => renderMessage(msg, index))}
            <div ref={messagesEndRef} />
          </List>
        )}
      </Box>

      <Divider />

      {/* Message Input */}
      <Box sx={{ p: 2 }}>
        {!botEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Bot is disabled. You are chatting directly with the user.
          </Alert>
        )}
        
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sending}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark'
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground'
              }
            }}
          >
            {sending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  );
}

export default MessengerChat;