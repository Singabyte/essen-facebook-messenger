const axios = require('axios');
const { db } = require('./database-pg');
const { generateResponseWithHistory, generateResponseWithHistoryAndImages } = require('./geminiClient');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// In-memory cache for deduplication
const recentMessages = new Map(); // Map of senderId -> { messageText, timestamp }
const processedMessageIds = new Set(); // Set of processed message IDs
const DEDUP_WINDOW_MS = 5000; // 5 second window

// Utility function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  // Safety check - never send empty messages
  if (!text || !text.trim()) {
    console.error('Attempted to send empty message, aborting');
    return null;
  }
  
  const messageData = {
    recipient: { id: recipientId },
    message: { text: text.trim() }
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
    // Save user if new
    await db.saveUser(senderId, { name: 'User' });
    
    // Get conversation history
    const history = await db.getConversationHistory(senderId, 5);
    
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
    
    // Final safety check - ensure no empty messages
    const validMessages = messages.filter(m => m.text && m.text.trim());
    
    if (validMessages.length === 0) {
      console.error('No valid messages after parsing, using emergency fallback');
      const emergencyMessage = imageUrls.length > 0 
        ? 'thanks for the photo! let me help you find the perfect ESSEN product for your space! 😊'
        : 'hey! let me help you with our amazing promos on vanity sets, kitchen sinks, and toilet bowls! which one interests you? 😊';
      await sendMessage(senderId, emergencyMessage);
      await db.saveConversation(senderId, userMessage, emergencyMessage);
      return;
    }
    
    if (validMessages.length > 1) {
      // Multiple messages - send with delays
      await sendMultipleMessages(senderId, validMessages);
      
      // Save all messages to conversation history
      const fullResponse = validMessages.map(m => m.text).join(' ');
      await db.saveConversation(senderId, userMessage, fullResponse);
    } else {
      // Single message - use consistent message format
      await sendMessage(senderId, validMessages[0].text);
      await db.saveConversation(senderId, userMessage, validMessages[0].text);
    }
    
  } catch (error) {
    console.error('Error handling message:', error);
    await sendMessage(senderId, 'Sorry, I encountered an error. Please try again or call us at +65 6019 0775.');
  }
}


// Simple appointment handler - COMMENTED OUT FOR NOW
// async function handleAppointmentBooking(senderId, messageText) {
//   // Look for date and time patterns
//   const timeMatch = messageText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
//   const hasDate = /tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/-]\d{1,2}/i.test(messageText);
//   
//   if (timeMatch && hasDate) {
//     // Simple validation - check if within operating hours
//     const time = timeMatch[0].toLowerCase();
//     const hour = parseInt(time);
//     const isPM = time.includes('pm');
//     const adjustedHour = isPM && hour !== 12 ? hour + 12 : hour;
//     
//     if (adjustedHour < 11 || adjustedHour >= 19) {
//       return `Our showroom is open 11am-7pm daily. Please choose a time within these hours.`;
//     }
//     
//     // Simple appointment confirmation
//     await db.saveAppointment(senderId, 'User', messageText, time, null);
//     
//     return `Great! I've noted your appointment request. Our team will confirm shortly.
// 📍 Location: 36 Jalan Kilang Barat
// 📞 We'll call you to confirm, or you can call us at +65 6019 0775`;
//   }
//   
//   // Prompt for details if not complete
//   if (messageText.toLowerCase().includes('appointment') || messageText.toLowerCase().includes('book')) {
//     return `I'd love to schedule your visit! When would you like to come? 
// We're open 11am-7pm daily. Just tell me your preferred date and time.`;
//   }
//   
//   return null; // Not appointment related
// }

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