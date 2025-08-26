const axios = require('axios');
const { db } = require('./database-pg');
const { generateResponseWithHistory, generateResponseWithHistoryAndImages } = require('./geminiClient');
const { metricsCollector } = require('./monitoring');
const adminSocketClient = require('./admin-socket-client');
const platformAdapter = require('./platform-adapter');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Cache for user profiles to avoid repeated API calls
const userProfileCache = new Map();

// In-memory cache for deduplication
const recentMessages = new Map(); // Map of senderId -> { messageText, timestamp }
const processedMessageIds = new Set(); // Set of processed message IDs
const DEDUP_WINDOW_MS = 5000; // 5 second window

// Message batching - collect messages for 30 seconds before processing
const messageBatches = new Map(); // Map of senderId -> { messages: [], images: [], timer: null, firstMessageTime: Date }
const BATCH_TIMEOUT_MS = 30000; // 30 seconds

// Utility function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch user profile from platform API
async function getUserProfile(userId, platform = 'facebook') {
  try {
    // Check cache first
    const cacheKey = `${platform}:${userId}`;
    if (userProfileCache.has(cacheKey)) {
      const cached = userProfileCache.get(cacheKey);
      // Cache for 24 hours
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return cached.data;
      }
    }
    
    console.log(`Fetching profile for user ${userId} from ${platform} API`);
    
    // Use platform adapter to get profile
    const profileData = await platformAdapter.getUserProfile(userId, platform);
    
    // Cache the profile
    userProfileCache.set(cacheKey, {
      data: profileData,
      timestamp: Date.now()
    });
    
    console.log(`Profile fetched for ${profileData.name} on ${platform}`);
    return profileData;
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    
    // Return default data if API call fails
    return {
      name: platform === 'instagram' ? 'Instagram User' : 'User',
      profile_pic: null,
      platform: platform
    };
  }
}

// Send typing indicator function
async function sendTypingIndicator(recipientId, isTyping = true, platform = 'facebook') {
  try {
    return await platformAdapter.sendTypingIndicator(recipientId, isTyping, platform);
  } catch (error) {
    console.error('Error sending typing indicator:', error);
    // Don't throw - typing indicators are not critical
  }
}

// Simple send message function
async function sendMessage(recipientId, text, platform = 'facebook') {
  try {
    return await platformAdapter.sendMessage(recipientId, text, platform);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Send multiple messages with delays
async function sendMultipleMessages(recipientId, messages, platform = 'facebook') {
  for (let i = 0; i < messages.length; i++) {
    const { text, waitAfter = 0 } = messages[i];
    
    // Send typing indicator before each message
    await sendTypingIndicator(recipientId, true, platform);
    
    // Fixed delay to show typing (5000ms)
    await delay(5000);
    
    // Send the actual message
    await sendMessage(recipientId, text, platform);
    
    // Wait after message if specified and not the last message
    if (waitAfter > 0 && i < messages.length - 1) {
      await delay(waitAfter);
    }
  }
}

// Parse multi-message response with intelligent splitting
function parseMultiMessageResponse(response) {
  // Check if response contains the delimiter ||WAIT:xxxx||
  const delimiter = /\|\|WAIT:(\d+)\|\|/g;
  const parts = response.split(delimiter);
  
  // Check if it's a short response that should remain as single message
  const isShortResponse = response.length < 150 && !response.includes('||WAIT:');
  
  if (parts.length === 1) {
    // No delimiter found - check if we should auto-split
    const text = response.trim();
    
    // Auto-split logic for messages without explicit delimiters
    // Look for patterns that indicate a natural break
    const autoSplitPatterns = [
      /([.!])\s+([Ww]hen\s+(would|can|are|will)\s+you)/,
      /([.!])\s+([Ww]ould\s+you\s+like)/,
      /([.!])\s+([Ww]ant\s+to\s+)/,
      /([.!])\s+([Aa]re\s+you\s+(looking|interested|planning|thinking))/,
      /([.!])\s+([Dd]o\s+you\s+(need|want|have))/,
      /([.!])\s+([Ww]hich\s+)/,
      /([.!])\s+([Ww]hat\s+(time|day)\s+)/
    ];
    
    // Only auto-split if message is long enough and contains a question pattern
    if (!isShortResponse && text.length > 150) {
      for (const pattern of autoSplitPatterns) {
        const match = text.match(pattern);
        if (match) {
          const splitIndex = match.index + match[1].length;
          const firstPart = text.substring(0, splitIndex).trim();
          const secondPart = text.substring(splitIndex).trim();
          
          if (firstPart && secondPart && secondPart.length > 20) {
            return [
              { text: firstPart, waitAfter: 2000 },
              { text: secondPart, waitAfter: 0 }
            ];
          }
        }
      }
    }
    
    // No auto-split applicable
    return [{ text: text, waitAfter: 0 }];
  }
  
  // Parse multi-message format with explicit delimiters
  const messages = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i].trim();
    if (text) {
      const waitAfter = i + 1 < parts.length ? parseInt(parts[i + 1]) || 0 : 0;
      messages.push({ text, waitAfter });
    }
  }
  
  // Limit to maximum 2 messages
  if (messages.length > 2) {
    // Combine all messages after the first into the second message
    const firstMessage = messages[0];
    const remainingText = messages.slice(1).map(m => m.text).join(' ');
    
    return [
      firstMessage,
      { text: remainingText, waitAfter: 0 }
    ];
  }
  
  return messages;
}

// Process batched messages after timeout
async function processBatchedMessages(senderId, platform = 'facebook') {
  const batch = messageBatches.get(senderId);
  if (!batch || (batch.messages.length === 0 && batch.images.length === 0)) {
    console.log(`No messages to process for ${senderId}`);
    return;
  }
  
  // Clear timer and remove batch
  if (batch.timer) {
    clearTimeout(batch.timer);
  }
  messageBatches.delete(senderId);
  
  // Combine all messages into single prompt
  const combinedMessage = batch.messages.join('\n');
  const allImages = batch.images;
  
  console.log(`Processing batch for ${senderId} on ${platform}: ${batch.messages.length} messages, ${allImages.length} images`);
  
  try {
    const startTime = Date.now();
    
    // Fetch and save user profile
    const userProfile = await getUserProfile(senderId, platform);
    await db.saveUser(senderId, userProfile, platform);
    
    // Get conversation history
    const history = await db.getConversationHistory(senderId, 15, platform);
    
    // Generate AI response with retry logic
    let response = '';
    let retries = 0;
    const maxRetries = 3;
    
    while ((!response || !response.trim()) && retries < maxRetries) {
      if (retries > 0) {
        console.log(`Retry ${retries}/${maxRetries} - Empty response from Gemini, retrying...`);
        await delay(500);
      }
      
      // If there are images, use enhanced response function
      if (allImages.length > 0) {
        response = await generateResponseWithHistoryAndImages(combinedMessage, history, allImages);
      } else {
        response = await generateResponseWithHistory(combinedMessage, history);
      }
      
      retries++;
    }
    
    // If still empty after retries, use fallback
    if (!response || !response.trim()) {
      console.error('Empty response from Gemini after all retries');
      if (allImages.length > 0) {
        response = 'thanks for sharing the photo! let me help you with that. could you tell me more about what you\'re looking for? 😊';
      } else {
        response = 'hey! sorry, could you say that again? i want to make sure i understand correctly! 😊';
      }
    }
    
    // Parse response for multiple messages
    const messages = parseMultiMessageResponse(response);
    
    if (messages.length > 1) {
      // Multiple messages - send with delays
      await sendMultipleMessages(senderId, messages, platform);
      
      // Save all messages to conversation history
      const fullResponse = messages.map(m => m.text).join(' ');
      await db.saveConversation(senderId, combinedMessage, fullResponse, platform);
      
      // Record metrics and send to admin
      const responseTime = Date.now() - startTime;
      metricsCollector.recordMessage(senderId, Date.now(), responseTime);
      adminSocketClient.sendMessageProcessed({
        userId: senderId,
        userName: userProfile.name,
        messageText: combinedMessage || '[Image]',
        responseText: fullResponse,
        responseTime: responseTime
      });
    } else {
      // Single message - use consistent message format
      await sendMessage(senderId, messages[0].text, platform);
      await db.saveConversation(senderId, combinedMessage, messages[0].text, platform);
      
      // Record metrics and send to admin
      const responseTime = Date.now() - startTime;
      metricsCollector.recordMessage(senderId, Date.now(), responseTime);
      adminSocketClient.sendMessageProcessed({
        userId: senderId,
        userName: userProfile.name,
        messageText: combinedMessage || '[Image]',
        responseText: messages[0].text,
        responseTime: responseTime
      });
    }
    
  } catch (error) {
    console.error('Error processing batched messages:', error);
    await sendMessage(senderId, 'Sorry, I encountered an error. Please try again or call us at +65 6019 0775.', platform);
  }
}

// Handle incoming messages
async function handleMessage(event) {
  const senderId = event.sender.id;
  const messageText = event.message?.text;
  const messageAttachments = event.message?.attachments;
  const messageId = event.message?.mid;
  const platform = event.platform || 'facebook'; // Get platform from event
  
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
      await db.saveConversation(senderId, messageText || '[Image]', '', platform, true);
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
  
  // Add message to batch instead of processing immediately
  try {
    // Check if user has an active batch
    if (!messageBatches.has(senderId)) {
      messageBatches.set(senderId, {
        messages: [],
        images: [],
        timer: null,
        firstMessageTime: Date.now()
      });
      
      // Set 30-second timer to process batch
      const timer = setTimeout(() => {
        processBatchedMessages(senderId, platform);
      }, BATCH_TIMEOUT_MS);
      
      messageBatches.get(senderId).timer = timer;
      console.log(`Started new batch for ${senderId}, will process in 30 seconds`);
    }
    
    // Add message and images to batch
    const batch = messageBatches.get(senderId);
    if (messageText) {
      batch.messages.push(messageText);
    }
    if (imageUrls.length > 0) {
      batch.images.push(...imageUrls);
    }
    
    console.log(`Added to batch for ${senderId}: "${messageText || '[Image]'}" (Total: ${batch.messages.length} messages, ${batch.images.length} images)`);
    
  } catch (error) {
    console.error('Error adding message to batch:', error);
    // If batching fails, process immediately as fallback
    await processBatchedMessages(senderId, platform);
  }
}

// Handle postback events (button clicks)
async function handlePostback(event) {
  const senderId = event.sender.id;
  const payload = event.postback.payload;
  const platform = event.platform || 'facebook';
  
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
    
    await sendMessage(senderId, response, platform);
    await db.saveConversation(senderId, `[Clicked: ${payload}]`, response, platform);
    
  } catch (error) {
    console.error('Error handling postback:', error);
  }
}

module.exports = {
  handleMessage,
  handlePostback
};