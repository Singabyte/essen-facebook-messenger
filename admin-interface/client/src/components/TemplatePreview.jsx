import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  TextField,
  Chip,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Phone as PhoneIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

function TemplatePreview({ template, variables = {}, onClose, onVariableChange }) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [userVariables, setUserVariables] = useState(variables);

  useEffect(() => {
    if (template) {
      initializePreview();
    }
  }, [template, userVariables]);

  const initializePreview = () => {
    setMessages([]);
    setCurrentStep(0);
    setIsPlaying(false);
    
    // Add initial bot greeting if template has content
    if (template.content) {
      addMessage({
        sender: 'bot',
        content: processTemplateContent(template.content),
        timestamp: new Date(),
        type: 'text'
      });
    }
  };

  const processTemplateContent = (content) => {
    if (!content) return content;
    
    let processedContent = content;
    
    // Replace variables
    Object.entries(userVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, value || `{${key}}`);
    });
    
    return processedContent;
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, {
      ...message,
      id: Date.now() + Math.random()
    }]);
  };

  const simulateUserMessage = (text) => {
    addMessage({
      sender: 'user',
      content: text,
      timestamp: new Date(),
      type: 'text'
    });
  };

  const simulateBotResponse = (content, type = 'text', options = {}) => {
    setTimeout(() => {
      addMessage({
        sender: 'bot',
        content: processTemplateContent(content),
        timestamp: new Date(),
        type,
        ...options
      });
    }, 1000 / playbackSpeed);
  };

  const handleQuickReply = (reply) => {
    simulateUserMessage(reply.title);
    
    // Simulate bot response based on quick reply
    setTimeout(() => {
      const responses = {
        'more_info': 'Here\'s more information about our products...',
        'book_appointment': 'Great! Let me help you book an appointment.',
        'contact': 'You can reach us at +65 6XXX XXXX',
        'showroom': 'Our showroom is located at...',
        'default': 'Thank you for your selection!'
      };
      
      const response = responses[reply.payload] || responses.default;
      simulateBotResponse(response);
    }, 1500 / playbackSpeed);
  };

  const handleUserInput = () => {
    if (userInput.trim()) {
      simulateUserMessage(userInput);
      setUserInput('');
      
      // Simulate bot acknowledgment
      setTimeout(() => {
        simulateBotResponse('Thank you for your message. How else can I help you?');
      }, 1000 / playbackSpeed);
    }
  };

  const playAutomatedDemo = () => {
    setIsPlaying(true);
    const demoSteps = [
      () => simulateUserMessage('Hi, I\'m interested in your products'),
      () => simulateBotResponse('Hello! I\'d be happy to help you with our ESSEN furniture collection.'),
      () => simulateBotResponse('What type of furniture are you looking for?', 'quick_reply', {
        quick_replies: [
          { title: 'Sofas', payload: 'sofas' },
          { title: 'Dining Sets', payload: 'dining' },
          { title: 'Bedroom', payload: 'bedroom' }
        ]
      }),
    ];
    
    demoSteps.forEach((step, index) => {
      setTimeout(step, (index * 2000) / playbackSpeed);
    });
    
    setTimeout(() => setIsPlaying(false), (demoSteps.length * 2000) / playbackSpeed);
  };

  const renderMessage = (message) => {
    const isBot = message.sender === 'bot';
    
    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isBot ? 'flex-start' : 'flex-end',
          mb: 2,
          alignItems: 'flex-end'
        }}
      >
        {isBot && (
          <Avatar sx={{ mr: 1, bgcolor: 'primary.main', width: 32, height: 32 }}>
            <BotIcon sx={{ fontSize: 18 }} />
          </Avatar>
        )}
        
        <Box sx={{ maxWidth: '70%' }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: isBot ? 'grey.100' : 'primary.main',
              color: isBot ? 'text.primary' : 'primary.contrastText',
              borderRadius: 2,
              borderBottomLeftRadius: isBot ? 0.5 : 2,
              borderBottomRightRadius: isBot ? 2 : 0.5,
            }}
          >
            {message.type === 'image' && message.media_url && (
              <Box sx={{ mb: 1 }}>
                <img
                  src={message.media_url}
                  alt="Message attachment"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: 4
                  }}
                />
              </Box>
            )}
            
            <Typography variant="body1">
              {message.content}
            </Typography>
            
            {message.quick_replies && message.quick_replies.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {message.quick_replies.map((reply, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    size="small"
                    onClick={() => handleQuickReply(reply)}
                    sx={{
                      borderColor: isBot ? 'primary.main' : 'white',
                      color: isBot ? 'primary.main' : 'white',
                      '&:hover': {
                        borderColor: isBot ? 'primary.dark' : 'grey.200',
                        bgcolor: isBot ? 'primary.50' : 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    {reply.title}
                  </Button>
                ))}
              </Box>
            )}
          </Paper>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {message.timestamp.toLocaleTimeString()}
          </Typography>
        </Box>
        
        {!isBot && (
          <Avatar sx={{ ml: 1, bgcolor: 'secondary.main', width: 32, height: 32 }}>
            <PersonIcon sx={{ fontSize: 18 }} />
          </Avatar>
        )}
      </Box>
    );
  };

  const renderVariableSettings = () => {
    if (!template.variables || template.variables.length === 0) {
      return (
        <Alert severity="info">
          This template doesn't use any variables.
        </Alert>
      );
    }

    const templateVars = Array.isArray(template.variables) ? template.variables : JSON.parse(template.variables || '[]');

    return (
      <Grid container spacing={2}>
        {templateVars.map((variable, index) => (
          <Grid item xs={12} md={6} key={index}>
            <TextField
              fullWidth
              label={variable.name}
              value={userVariables[variable.name] || variable.default_value || ''}
              onChange={(e) => {
                const newVars = { ...userVariables, [variable.name]: e.target.value };
                setUserVariables(newVars);
                onVariableChange?.(newVars);
              }}
              helperText={variable.description}
              size="small"
            />
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Template Preview: {template?.name || 'Untitled'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip 
            label={`Speed: ${playbackSpeed}x`} 
            size="small" 
            color="primary"
            variant="outlined"
          />
          <IconButton onClick={() => setShowSettings(true)} size="small">
            <SettingsIcon />
          </IconButton>
          <IconButton onClick={initializePreview} size="small">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Chat Area */}
      <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto', bgcolor: 'grey.50' }}>
        {/* Phone mockup header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1, bgcolor: 'primary.main', color: 'white', borderRadius: 1 }}>
          <Avatar sx={{ mr: 2, bgcolor: 'white', color: 'primary.main' }}>
            <BotIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1">ESSEN Bot</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
              <Typography variant="caption">Online</Typography>
            </Box>
          </Box>
          <IconButton color="inherit" size="small">
            <PhoneIcon />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box sx={{ minHeight: 300 }}>
          {messages.map(renderMessage)}
        </Box>

        {/* Demo Actions */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={playAutomatedDemo}
            disabled={isPlaying}
            startIcon={<ScheduleIcon />}
          >
            {isPlaying ? 'Playing Demo...' : 'Play Demo'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleQuickReply({ title: 'More Info', payload: 'more_info' })}
          >
            Simulate "More Info"
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleQuickReply({ title: 'Book Appointment', payload: 'book_appointment' })}
          >
            Simulate "Book Appointment"
          </Button>
        </Box>
      </Box>

      {/* Input Area */}
      <Paper sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          placeholder="Type a message..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
          size="small"
        />
        <IconButton onClick={handleUserInput} color="primary">
          <SendIcon />
        </IconButton>
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Preview Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>Playback Speed</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(e.target.value)}
              >
                <MenuItem value={0.5}>0.5x (Slow)</MenuItem>
                <MenuItem value={1}>1x (Normal)</MenuItem>
                <MenuItem value={2}>2x (Fast)</MenuItem>
                <MenuItem value={4}>4x (Very Fast)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Template Variables
          </Typography>
          {renderVariableSettings()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
          <Button onClick={initializePreview} variant="contained">
            Apply & Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TemplatePreview;