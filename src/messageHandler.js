const axios = require('axios');
const { db } = require('./database-pg');
const { generateResponseWithHistory, generateResponseWithHistoryAndImages } = require('./geminiClient');
const { metricsCollector } = require('./monitoring');
const adminSocketClient = require('./admin-socket-client');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Cache for user profiles to avoid repeated API calls
const userProfileCache = new Map();

// In-memory cache for deduplication
const recentMessages = new Map(); // Map of senderId -> { messageText, timestamp }
const processedMessageIds = new Set(); // Set of processed message IDs
const DEDUP_WINDOW_MS = 5000; // 5 second window

// Utility function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch user profile from Facebook Graph API
async function getUserProfile(userId) {
  try {
    // Check cache first
    if (userProfileCache.has(userId)) {
      const cached = userProfileCache.get(userId);
      // Cache for 24 hours
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return cached.data;
      }
    }
    
    console.log(`Fetching profile for user ${userId} from Facebook API`);
    
    const response = await axios.get(
      `${FACEBOOK_API_URL}/${userId}`,
      {
        params: {
          fields: 'first_name,last_name,profile_pic,locale,timezone',
          access_token: process.env.PAGE_ACCESS_TOKEN
        }
      }
    );
    
    const profileData = {
      name: `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim() || 'User',
      first_name: response.data.first_name,
      last_name: response.data.last_name,
      profile_pic: response.data.profile_pic,
      locale: response.data.locale,
      timezone: response.data.timezone
    };
    
    // Cache the profile
    userProfileCache.set(userId, {
      data: profileData,
      timestamp: Date.now()
    });
    
    console.log(`Profile fetched for ${profileData.name}`);
    return profileData;
    
  } catch (error) {
    console.error('Error fetching user profile:', error.response?.data || error.message);
    
    // Return default data if API call fails
    return {
      name: 'User',
      profile_pic: null
    };
  }
}

// Send typing indicator function
async function sendTypingIndicator(recipientId, isTyping = true) {
  const messageData = {
    recipient: { id: recipientId },
    sender_action: isTyping ? "typing_on" : "typing_off"
  };
  
  try {
    const response = await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      messageData,
      { params: { access_token: process.env.PAGE_ACCESS_TOKEN } }
    );
    console.log(`Typing indicator ${isTyping ? 'on' : 'off'} sent`);
    return response.data;
  } catch (error) {
    console.error('Error sending typing indicator:', error.response?.data || error.message);
    // Don't throw - typing indicators are not critical
  }
}

// Simple send message function
async function sendMessage(recipientId, text) {
  const messageData = {
    recipient: { id: recipientId },
    message: { text }
  };
  
  try {
    const response = await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      messageData,
      { params: { access_token: process.env.PAGE_ACCESS_TOKEN } }
    );
    console.log('Message sent successfully');
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

// Send multiple messages with delays
async function sendMultipleMessages(recipientId, messages) {
  for (let i = 0; i < messages.length; i++) {
    const { text, waitAfter = 0 } = messages[i];
    
    // Send typing indicator before each message
    await sendTypingIndicator(recipientId, true);
    
    // Fixed delay to show typing (5000ms)
    await delay(5000);
    
    // Send the actual message
    await sendMessage(recipientId, text);
    
    // Wait after message if specified and not the last message
    if (waitAfter > 0 && i < messages.length - 1) {
      await delay(waitAfter);
    }
  }
}

// Parse multi-message response
function parseMultiMessageResponse(response) {
  // Check if response contains the delimiter ||WAIT:xxxx||
  const delimiter = /\|\|WAIT:(\d+)\|\|/g;
  const parts = response.split(delimiter);
  
  if (parts.length === 1) {
    // No delimiter found - single message
    return [{ text: response.trim(), waitAfter: 0 }];
  }
  
  // Parse multi-message format
  const messages = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i].trim();
    if (text) {
      const waitAfter = i + 1 < parts.length ? parseInt(parts[i + 1]) || 0 : 0;
      messages.push({ text, waitAfter });
    }
  }
  
  return messages;
}

// Handle incoming messages
async function handleMessage(event) {
  const senderId = event.sender.id;
  const messageText = event.message?.text;
  const messageAttachments = event.message?.attachments;
  const messageId = event.message?.mid;
  
  // Check if message has neither text nor attachments
  if (!messageText && !messageAttachments) {
    console.log('No message content to process');
    return;
  }
  
  // Check if bot is enabled for this user
  try {
    const botStatus = await db.getBotStatusForUser(senderId);
    if (!botStatus.bot_enabled || botStatus.admin_takeover) {
      console.log(`Bot disabled for user ${senderId} - admin takeover active`);
      // Still save the message to database for admin to see
      await db.saveConversation(senderId, messageText || '[Image]', '', true);
      // Emit to admin interface via WebSocket if connected
      if (global.adminSocketClient) {
        global.adminSocketClient.emit('user-message-while-disabled', {
          user_id: senderId,
          message: messageText || '[Image]',
          timestamp: new Date()
        });
      }
      return; // Don't process with bot
    }
  } catch (error) {
    console.error('Error checking bot status:', error);
    // Continue processing if we can't check status
  }
  
  // Extract image URLs from attachments
  let imageUrls = [];
  if (messageAttachments) {
    imageUrls = messageAttachments
      .filter(att => att.type === 'image' && att.payload?.url)
      .map(att => att.payload.url);
    
    if (imageUrls.length > 0) {
      console.log(`Received ${imageUrls.length} image(s) from user ${senderId}`);
    }
  }
  
  // Check if we've already processed this message ID
  if (messageId && processedMessageIds.has(messageId)) {
    console.log(`Message ${messageId} already processed, skipping`);
    return;
  }
  
  // Add message ID to processed set
  if (messageId) {
    processedMessageIds.add(messageId);
    // Clean up old message IDs if set gets too large
    if (processedMessageIds.size > 1000) {
      // Keep only the last 500 message IDs
      const idsArray = Array.from(processedMessageIds);
      processedMessageIds.clear();
      idsArray.slice(-500).forEach(id => processedMessageIds.add(id));
    }
  }
  
  // Check for duplicate messages
  const lastMessage = recentMessages.get(senderId);
  if (lastMessage) {
    const timeSinceLastMessage = Date.now() - lastMessage.timestamp;
    if (lastMessage.messageText === messageText && timeSinceLastMessage < DEDUP_WINDOW_MS) {
      console.log(`Duplicate message detected from ${senderId}, ignoring (${timeSinceLastMessage}ms since last)`);
      return;
    }
  }
  
  // Update recent message cache
  recentMessages.set(senderId, {
    messageText,
    timestamp: Date.now()
  });
  
  // Clean up old entries periodically
  if (recentMessages.size > 100) {
    const cutoffTime = Date.now() - DEDUP_WINDOW_MS;
    for (const [id, data] of recentMessages.entries()) {
      if (data.timestamp < cutoffTime) {
        recentMessages.delete(id);
      }
    }
  }
  
  try {
    const startTime = Date.now(); // Track response time
    
    // Fetch and save user profile
    const userProfile = await getUserProfile(senderId);
    await db.saveUser(senderId, userProfile);
    
    // Get conversation history
    const history = await db.getConversationHistory(senderId, 15);
    
    // Generate AI response for all messages with retry logic
    let response = '';
    let retries = 0;
    const maxRetries = 3;
    
    // Prepare message content - could be text, image, or both
    const userMessage = messageText || '';
    
    while ((!response || !response.trim()) && retries < maxRetries) {
      if (retries > 0) {
        console.log(`Retry ${retries}/${maxRetries} - Empty response from Gemini, retrying...`);
        await delay(500); // Small delay before retry
      }
      
      // If there are images, use enhanced response function
      if (imageUrls.length > 0) {
        response = await generateResponseWithHistoryAndImages(userMessage, history, imageUrls);
      } else {
        response = await generateResponseWithHistory(userMessage, history);
      }
      
      retries++;
    }
    
    // If still empty after retries, use fallback
    if (!response || !response.trim()) {
      console.error('Empty response from Gemini after all retries');
      if (imageUrls.length > 0) {
        response = 'thanks for sharing the photo! let me help you with that. could you tell me more about what you\'re looking for? 😊';
      } else {
        response = 'hey! sorry, could you say that again? i want to make sure i understand correctly! 😊';
      }
    }
    
    // Parse response for multiple messages
    const messages = parseMultiMessageResponse(response);
    
    if (messages.length > 1) {
      // Multiple messages - send with delays
      await sendMultipleMessages(senderId, messages);
      
      // Save all messages to conversation history
      const fullResponse = messages.map(m => m.text).join(' ');
      await db.saveConversation(senderId, messageText, fullResponse);
      
      // Record metrics and send to admin
      const responseTime = Date.now() - startTime;
      metricsCollector.recordMessage(senderId, Date.now(), responseTime);
      adminSocketClient.sendMessageProcessed({
        userId: senderId,
        userName: userProfile.name,
        messageText: messageText || '[Image]',
        responseText: fullResponse,
        responseTime: responseTime
      });
    } else {
      // Single message - use consistent message format
      await sendMessage(senderId, messages[0].text);
      await db.saveConversation(senderId, messageText, messages[0].text);
      
      // Record metrics and send to admin
      const responseTime = Date.now() - startTime;
      metricsCollector.recordMessage(senderId, Date.now(), responseTime);
      adminSocketClient.sendMessageProcessed({
        userId: senderId,
        userName: userProfile.name,
        messageText: messageText || '[Image]',
        responseText: messages[0].text,
        responseTime: responseTime
      });
    }
    
  } catch (error) {
    console.error('Error handling message:', error);
    await sendMessage(senderId, 'Sorry, I encountered an error. Please try again or call us at +65 6019 0775.');
  }
}

// Handle postback events (button clicks)
async function handlePostback(event) {
  const senderId = event.sender.id;
  const payload = event.postback.payload;
  
  try {
    let response = '';
    
    switch (payload) {
      case 'GET_STARTED':
        response = `Welcome to ESSEN Furniture! 🏠 

We're your one-stop for furniture, kitchen & bathroom solutions.

How can I help you today?`;
        break;
        
      default:
        response = `Thanks for clicking! How can I help you?`;
    }
    
    await sendMessage(senderId, response);
    await db.saveConversation(senderId, `[Clicked: ${payload}]`, response);
    
  } catch (error) {
    console.error('Error handling postback:', error);
  }
}

module.exports = {
  handleMessage,
  handlePostback
};