const axios = require('axios');
const { 
  createOrUpdateUser, 
  saveConversation, 
  getConversationHistory,
  getUserPreferences,
  saveUserPreferences,
  logAnalytics 
} = require('./database');
const { 
  generateResponseWithHistory, 
  generateQuickReplies 
} = require('./geminiClient');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Handle incoming messages
async function handleMessage(event) {
  const senderId = event.sender.id;
  const message = event.message;
  
  try {
    // Log message received
    await logAnalytics('message_received', senderId, {
      messageType: message.text ? 'text' : 'other',
      hasAttachments: !!message.attachments
    });
    
    // Get user info and save/update
    const userInfo = await getUserInfo(senderId);
    await createOrUpdateUser(senderId, userInfo.name, userInfo.profile_pic);
    
    // Send typing indicator
    await sendTypingIndicator(senderId, true);
    
    let responseText = '';
    
    if (message.text) {
      // Handle text messages
      responseText = await handleTextMessage(senderId, message.text);
    } else if (message.attachments) {
      // Handle attachments
      responseText = await handleAttachments(message.attachments);
    } else if (message.quick_reply) {
      // Handle quick reply
      responseText = await handleQuickReply(senderId, message.quick_reply);
    }
    
    // Send response
    if (responseText) {
      // Check if we should add quick replies
      const shouldAddQuickReplies = message.text && !message.quick_reply;
      
      if (shouldAddQuickReplies) {
        const quickReplies = await generateQuickReplies(message.text, responseText);
        await sendQuickReply(senderId, responseText, quickReplies);
      } else {
        await sendTextMessage(senderId, responseText);
      }
      
      // Save conversation
      await saveConversation(senderId, message.text || '[attachment]', responseText);
    }
    
    // Turn off typing indicator
    await sendTypingIndicator(senderId, false);
    
  } catch (error) {
    console.error('Error handling message:', error);
    await sendTextMessage(senderId, 'Sorry, I encountered an error. Please try again.');
    await logAnalytics('message_error', senderId, { error: error.message });
  }
}

// Handle text messages
async function handleTextMessage(senderId, text) {
  // Check for special commands
  if (text.toLowerCase() === '/help') {
    return getHelpMessage();
  } else if (text.toLowerCase() === '/clear') {
    return 'Conversation history cleared. How can I help you today?';
  } else if (text.toLowerCase() === '/about') {
    return 'I\'m a helpful assistant powered by Google\'s Gemini AI. I can answer questions, have conversations, and help with various tasks. How can I assist you today?';
  }
  
  // Get conversation history
  const history = await getConversationHistory(senderId, 5);
  
  // Generate response using Gemini
  const response = await generateResponseWithHistory(text, history);
  
  return response;
}

// Handle attachments
async function handleAttachments(attachments) {
  const attachment = attachments[0];
  
  switch (attachment.type) {
    case 'image':
      return 'I received your image. Currently, I can only process text messages. Please describe what you\'d like help with!';
    case 'video':
      return 'I received your video. Currently, I can only process text messages. How can I help you today?';
    case 'audio':
      return 'I received your audio message. Currently, I can only process text messages. Please type your message!';
    case 'file':
      return 'I received your file. Currently, I can only process text messages. What would you like to know?';
    default:
      return 'I received your attachment. How can I help you today?';
  }
}

// Handle quick replies
async function handleQuickReply(senderId, quickReply) {
  const payload = quickReply.payload;
  
  // Handle different quick reply payloads
  switch (payload) {
    case 'HELP':
      return getHelpMessage();
    case 'START_OVER':
      return 'Let\'s start fresh! How can I help you today?';
    default:
      // Treat as regular text message
      return await handleTextMessage(senderId, payload);
  }
}

// Handle postback events
async function handlePostback(event) {
  const senderId = event.sender.id;
  const payload = event.postback.payload;
  
  try {
    await sendTypingIndicator(senderId, true);
    
    let responseText = '';
    
    switch (payload) {
      case 'GET_STARTED':
        responseText = 'Welcome! I\'m here to help. You can ask me questions, have a conversation, or type /help to see what I can do.';
        break;
      case 'HELP':
        responseText = getHelpMessage();
        break;
      default:
        responseText = `You clicked: ${payload}`;
    }
    
    await sendTextMessage(senderId, responseText);
    await sendTypingIndicator(senderId, false);
    
    await logAnalytics('postback_received', senderId, { payload });
  } catch (error) {
    console.error('Error handling postback:', error);
  }
}

// Get user info from Facebook
async function getUserInfo(userId) {
  try {
    const response = await axios.get(`${FACEBOOK_API_URL}/${userId}`, {
      params: {
        fields: 'first_name,last_name,profile_pic',
        access_token: process.env.PAGE_ACCESS_TOKEN
      }
    });
    
    return {
      name: `${response.data.first_name} ${response.data.last_name || ''}`.trim(),
      profile_pic: response.data.profile_pic
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return { name: null, profile_pic: null };
  }
}

// Send text message
async function sendTextMessage(recipientId, messageText) {
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText }
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    
    await logAnalytics('message_sent', recipientId, { type: 'text' });
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error);
    throw error;
  }
}

// Send quick reply
async function sendQuickReply(recipientId, text, quickReplies) {
  try {
    const message = {
      text: text,
      quick_replies: quickReplies.map(reply => ({
        content_type: 'text',
        title: reply,
        payload: reply
      }))
    };
    
    await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: message
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    
    await logAnalytics('message_sent', recipientId, { type: 'quick_reply' });
  } catch (error) {
    console.error('Error sending quick reply:', error.response?.data || error);
    // Fallback to regular text message
    await sendTextMessage(recipientId, text);
  }
}

// Send typing indicator
async function sendTypingIndicator(recipientId, isTyping) {
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        sender_action: isTyping ? 'typing_on' : 'typing_off'
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
  } catch (error) {
    console.error('Error sending typing indicator:', error.response?.data || error);
  }
}

// Get help message
function getHelpMessage() {
  return `Here's what I can help you with:

📝 Ask me any questions
💬 Have a conversation
🔧 Get assistance with various topics

Commands:
/help - Show this help message
/clear - Clear conversation history
/about - Learn more about me

Just type your message and I'll do my best to help!`;
}

module.exports = {
  handleMessage,
  handlePostback
};