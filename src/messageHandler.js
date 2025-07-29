const axios = require('axios');
const { 
  createOrUpdateUser, 
  saveConversation, 
  getConversationHistory,
  getUserPreferences,
  saveUserPreferences,
  logAnalytics,
  saveAppointment,
  getUser
} = require('./database');
const { 
  generateResponseWithHistory, 
  generateQuickReplies,
  getProductInfo
} = require('./geminiClient');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Store appointment booking state
const appointmentBookingState = new Map();

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
    } else if (responseText === null) {
      // null indicates the message was already sent (e.g., button template)
      // Save conversation with placeholder for button template
      await saveConversation(senderId, message.text || '[attachment]', '[Showroom info with buttons]');
    }
    
    // Turn off typing indicator
    await sendTypingIndicator(senderId, false);
    
  } catch (error) {
    console.error('Error handling message:', error);
    await sendTextMessage(senderId, 'Sorry, I encountered an error. Please try again or visit our showroom for immediate assistance!');
    await logAnalytics('message_error', senderId, { error: error.message });
  }
}

// Handle text messages
async function handleTextMessage(senderId, text) {
  // Check for special commands
  const command = text.toLowerCase().trim();
  
  if (command === '/help') {
    return getHelpMessage();
  } else if (command === '/products') {
    return getProductsMessage();
  } else if (command === '/showroom') {
    // Send showroom info with buttons instead of plain text
    await sendShowroomInfoWithButtons(senderId);
    return null; // Return null since we already sent the message
  } else if (command === '/consultation') {
    return getConsultationInfo();
  } else if (command === '/bestsellers') {
    return getBestSellers();
  } else if (command === '/about') {
    return getAboutESSEN();
  } else if (command === '/clear') {
    appointmentBookingState.delete(senderId); // Clear appointment state too
    return 'No problem! Let\'s start fresh. How can I help you transform your home today?';
  } else if (command === '/human' || command === '/agent') {
    // Transfer to human agent
    const { passThreadControl } = require('./facebook-integration');
    await passThreadControl(senderId, '263902037430900', 'Customer requested human agent');
    return 'I\'m connecting you with our human customer service team. They\'ll be with you shortly! 👨‍💼';
  }
  
  // Get user info for appointment booking
  const userInfo = await getUser(senderId);
  
  // Check for appointment booking flow
  const appointmentResponse = await handleAppointmentBooking(senderId, text, userInfo);
  if (appointmentResponse) {
    return appointmentResponse;
  }
  
  // Get conversation history
  const history = await getConversationHistory(senderId, 5);
  
  // Generate response using Gemini with ESSEN context
  const response = await generateResponseWithHistory(text, history);
  
  return response;
}

// Handle attachments
async function handleAttachments(attachments) {
  const attachment = attachments[0];
  
  switch (attachment.type) {
    case 'image':
      return 'Thanks for sharing the image! Currently I can only process text messages. But no worries - you can describe what you\'re looking for, or better yet, bring the image to our showroom where our design consultants can help you find the perfect match!';
    case 'video':
      return 'I received your video! For now, I can only handle text messages. Feel free to describe what you need, or visit our showroom for a more interactive experience!';
    case 'audio':
      return 'Got your audio message! I can only process text for now. Please type your question, or call our showroom directly for immediate assistance!';
    case 'file':
      return 'Thanks for the file! I can only read text messages at the moment. If you have floor plans or design ideas, our showroom consultants would love to review them with you - free consultation somemore!';
    default:
      return 'I received your attachment! How else can I help you with your furniture needs today?';
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
      return 'No problem! Let\'s start fresh. What are you looking for today? Furniture, kitchen, or bathroom solutions?';
    case 'View products':
      return getProductsMessage();
    case 'Visit showroom':
      // Use button template for showroom info
      await sendShowroomInfoWithButtons(senderId);
      return null; // Return null since we already sent the message
    case 'Free consultation':
    case 'Book consultation':
      appointmentBookingState.set(senderId, { stage: 'awaiting_details' });
      return "Great! When would you like to visit us? Just let me know your preferred date and time (we're open 11am-7pm daily).";
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
        responseText = getWelcomeMessage();
        break;
      case 'HELP':
        responseText = getHelpMessage();
        break;
      case 'PRODUCTS':
        responseText = getProductsMessage();
        break;
      case 'SHOWROOM':
        // Use button template for showroom info
        await sendShowroomInfoWithButtons(senderId);
        await sendTypingIndicator(senderId, false);
        await logAnalytics('postback_received', senderId, { payload });
        return; // Exit early since we already sent the message
      case 'CONSULTATION':
        responseText = getConsultationInfo();
        break;
      case 'BESTSELLERS':
        responseText = getBestSellers();
        break;
      case 'ABOUT':
        responseText = getAboutESSEN();
        break;
      case 'DELIVERY':
        responseText = 'Delivery typically takes 1-2 weeks for in-stock items, 6-8 weeks for pre-orders. Visit our showroom to check availability!';
        break;
      case 'CONTACT':
        await sendShowroomInfoWithButtons(senderId);
        await sendTypingIndicator(senderId, false);
        await logAnalytics('postback_received', senderId, { payload });
        return; // Exit early since we already sent the showroom info with contact buttons
      default:
        responseText = `Thanks for clicking! Let me help you with: ${payload}`;
    }
    
    // Send with quick replies for get started
    if (payload === 'GET_STARTED') {
      await sendQuickReply(senderId, responseText, [
        'View products',
        'Visit showroom',
        'Book consultation'
      ]);
    } else {
      await sendTextMessage(senderId, responseText);
    }
    
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

// Send button template with external URLs
async function sendButtonTemplate(recipientId, text, buttons) {
  try {
    const message = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text,
          buttons: buttons
        }
      }
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
    
    await logAnalytics('message_sent', recipientId, { type: 'button_template' });
  } catch (error) {
    console.error('Error sending button template:', error.response?.data || error);
    // Fallback to text message
    await sendTextMessage(recipientId, text);
  }
}

// Send showroom info with buttons
async function sendShowroomInfoWithButtons(recipientId) {
  const showroomText = `🏢 Visit Our Showroom!
📍 Location: 36 Jalan Kilang Barat, Singapore 159366
🕒 Hours: Operating Daily 11am - 7pm
📱 WhatsApp: +65 6019 0775
✨ In-Store Benefits:
- Complimentary refreshments
- Free design consultation
- Exclusive in-store discounts`;

  const buttons = [
    {
      type: 'web_url',
      url: 'https://wa.me/6560190775',
      title: 'WhatsApp Us!'
    },
    {
      type: 'web_url',
      url: 'https://maps.app.goo.gl/5YNjVuRRjCyGjNuY7',
      title: 'Get Directions'
    },
    {
      type: 'web_url',
      url: 'https://essen.sg/',
      title: 'Visit Website'
    }
  ];

  await sendButtonTemplate(recipientId, showroomText, buttons);
}

// ESSEN-specific message templates

function getWelcomeMessage() {
  return `Welcome to ESSEN Furniture! 🏠 We're your one-stop for furniture, kitchen & bathroom solutions.

What are you looking for today?`;
}

function getHelpMessage() {
  return `I can help with:
🛋️ Furniture | 🍳 Kitchen | 🚿 Bathroom | 📍 Showroom visits

Commands: 
/products /showroom /consultation /bestsellers /about

Quick options:
• "Show me sofas" - Browse furniture
• "Visit showroom" - Get location & hours
• "Book consultation" - Schedule a visit

Just ask your question or say "book appointment"!`;
}

function getProductsMessage() {
  return `Our categories:
🛋️ Living (sofas, tables) | 🍽️ Dining | 🛏️ Bedroom
🍳 Kitchen (sinks, taps) | 🚿 Bathroom | 💡 Lighting & fans

Which interests you?`;
}

function getShowroomInfo() {
  return `**ESSEN Furniture Showroom** 📍

See our fully furnished displays and get free design consultation! We're your one-stop for furniture + kitchen + bathroom.

Want to visit? Just let me know when - weekday mornings are usually quieter.`;
}

function getConsultationInfo() {
  return `**FREE Design Consultation** 🎨

Get expert help to transform your home - completely free! Our consultants specialize in maximizing HDB and condo spaces.

Want to book a visit? Just tell me when you'd like to come (we're open 11am-7pm daily)!`;
}

function getBestSellers() {
  return `**Best Sellers** 🌟
• Miku Electronic Sofa | Cascade Dining Table
• Nova Storage Bed | 4mm Leather Sofas

Visit showroom to see them? Some have waiting lists!`;
}

function getAboutESSEN() {
  return `**ESSEN Furniture** - Your Essential Living Expert
Established 2024 | Singapore's ONLY one-stop furniture + kitchen + bathroom retailer

✓ Free consultation | ✓ Premium quality | ✓ 5/5 Google rating

Visit us to experience the difference!`;
}

// Parse appointment details from text
function parseAppointmentDetails(text) {
  const details = {
    date: null,
    time: null,
    phone: null
  };
  
  // Parse date (tomorrow, today, specific dates)
  const tomorrow = /tomorrow/i.test(text);
  const today = /today/i.test(text);
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{2,4})?)/i);
  
  if (tomorrow) {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    details.date = tmrw.toLocaleDateString('en-SG');
  } else if (today) {
    details.date = new Date().toLocaleDateString('en-SG');
  } else if (dateMatch) {
    details.date = dateMatch[0];
  }
  
  // Parse time (11am-7pm format)
  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (timeMatch) {
    details.time = timeMatch[0].toLowerCase();
  }
  
  // Parse phone number (Singapore format)
  const phoneMatch = text.match(/(?:\+65\s?)?([89]\d{3}\s?\d{4})/);
  if (phoneMatch) {
    details.phone = phoneMatch[0].replace(/\s/g, '');
  }
  
  return details;
}

// Validate appointment time (11am-7pm)
function isValidAppointmentTime(timeStr) {
  if (!timeStr) return false;
  
  const time = timeStr.toLowerCase();
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return false;
  
  let hours = parseInt(match[1]);
  const isPM = match[3] === 'pm';
  
  // Convert to 24-hour format
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  
  // Check if within 11am-7pm (11:00-19:00)
  return hours >= 11 && hours < 19;
}

// Handle appointment booking flow
async function handleAppointmentBooking(senderId, text, userInfo) {
  const state = appointmentBookingState.get(senderId);
  
  // Check if user is starting appointment booking
  const isBookingRequest = /book|appointment|consultation|schedule|visit/i.test(text) && 
                          !/product|furniture|sofa|kitchen|bathroom/i.test(text);
  
  if (isBookingRequest && !state) {
    // Start booking flow
    appointmentBookingState.set(senderId, { stage: 'awaiting_details' });
    return "Great! When would you like to visit us? Just let me know your preferred date and time (we're open 11am-7pm daily).";
  }
  
  if (state && state.stage === 'awaiting_details') {
    const details = parseAppointmentDetails(text);
    
    if (!details.date || !details.time) {
      return "I need both a date and time for your visit. For example: 'Tomorrow at 2pm' or '25 Dec at 3:30pm'. We're open 11am-7pm daily.";
    }
    
    if (!isValidAppointmentTime(details.time)) {
      return "Our showroom is open 11am-7pm daily. Please choose a time within these hours.";
    }
    
    // Save appointment
    try {
      await saveAppointment(senderId, userInfo.name, details.date, details.time, details.phone);
      appointmentBookingState.delete(senderId);
      
      let confirmation = `Perfect! I've noted your visit for ${details.date} at ${details.time}. Looking forward to seeing you at our showroom! 📍 36 Jalan Kilang Barat`;
      if (details.phone) {
        confirmation += `\n\nWe'll WhatsApp you at ${details.phone} with a reminder.`;
      }
      
      await logAnalytics('appointment_booked', senderId, { date: details.date, time: details.time });
      return confirmation;
    } catch (error) {
      console.error('Error saving appointment:', error);
      appointmentBookingState.delete(senderId);
      return "Sorry, I couldn't save your appointment. Please try again or call us directly at +65 6019 0775.";
    }
  }
  
  return null; // Not appointment-related
}

module.exports = {
  handleMessage,
  handlePostback,
  // Export for testing
  parseAppointmentDetails,
  isValidAppointmentTime
};