const axios = require('axios');
const { db } = require('./database-pg');
const { 
  saveUser, 
  saveConversation, 
  getConversationHistory,
  clearConversationHistory,
  getUserPreferences,
  saveUserPreferences,
  logAnalytics,
  saveAppointment,
  getUser
} = db;
const { 
  generateResponseWithHistory, 
  generateQuickReplies,
  getProductInfo
} = require('./geminiClient');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Core messaging functions
async function callSendAPI(messageData) {
  try {
    if (!process.env.PAGE_ACCESS_TOKEN) {
      throw new Error('PAGE_ACCESS_TOKEN is not set');
    }
    
    console.log('Sending message to Facebook:', JSON.stringify({
      recipientId: messageData.recipient?.id,
      messageType: messageData.message ? 'message' : 'action',
      hasText: !!messageData.message?.text,
      hasAttachment: !!messageData.message?.attachment,
      hasQuickReplies: !!messageData.message?.quick_replies
    }));
    
    const response = await axios({
      method: 'post',
      url: `${FACEBOOK_API_URL}/me/messages`,
      params: {
        access_token: process.env.PAGE_ACCESS_TOKEN
      },
      data: messageData
    });
    
    console.log('Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to send message to Facebook');
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // Log specific Facebook error details
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      console.error('Facebook API Error:', {
        message: fbError.message,
        type: fbError.type,
        code: fbError.code,
        fbtrace_id: fbError.fbtrace_id
      });
    }
    
    throw error;
  }
}

// Send text message
async function sendTextMessage(recipientId, messageText) {
  const messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  
  return callSendAPI(messageData);
}

// Send typing indicator
async function sendTypingIndicator(recipientId, isTyping = true) {
  const messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: isTyping ? 'typing_on' : 'typing_off'
  };
  
  return callSendAPI(messageData);
}

// Send quick reply
async function sendQuickReply(recipientId, text, quickReplies) {
  // Format quick replies properly for Facebook
  const formattedQuickReplies = quickReplies.map(reply => {
    if (typeof reply === 'string') {
      return {
        content_type: 'text',
        title: reply,
        payload: reply
      };
    }
    return reply;
  });
  
  const messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text,
      quick_replies: formattedQuickReplies
    }
  };
  
  return callSendAPI(messageData);
}

// Send button template
async function sendButtonTemplate(recipientId, text, buttons) {
  const messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text,
          buttons: buttons
        }
      }
    }
  };
  
  return callSendAPI(messageData);
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
    console.error('Error fetching user info:', error);
    return {
      name: 'Customer',
      profile_pic: null
    };
  }
}

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
    await saveUser(senderId, userInfo);
    
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
  
  // Parse date (tomorrow, today, specific dates, days of week)
  const tomorrow = /tomorrow/i.test(text);
  const today = /today/i.test(text);
  
  // Enhanced date patterns
  const datePatterns = [
    // Day of week (thursday, friday, etc)
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // Ordinal dates (1st August, 2nd Jan, etc)
    /(\d{1,2}(?:st|nd|rd|th)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)/i,
    // Regular dates (1 August, 25 Dec, etc)
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{2,4})?)/i,
    // Numeric dates (25/12, 01-08-2024, etc)
    /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i
  ];
  
  if (tomorrow) {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    details.date = tmrw.toLocaleDateString('en-SG');
  } else if (today) {
    details.date = new Date().toLocaleDateString('en-SG');
  } else {
    // Try each date pattern
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        details.date = match[0];
        break;
      }
    }
  }
  
  // Parse time - more flexible pattern (handles "12pm", "12 pm", "12:30pm", etc)
  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:noon|midnight))/i);
  if (timeMatch) {
    let time = timeMatch[0].toLowerCase();
    // Handle special cases
    if (time === 'noon') time = '12pm';
    if (time === 'midnight') time = '12am';
    // Ensure space between number and am/pm for consistency
    time = time.replace(/(\d)(am|pm)/i, '$1 $2');
    details.time = time;
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
    // Check if the message already contains date and time
    const details = parseAppointmentDetails(text);
    
    if (details.date && details.time) {
      // Date and time already provided, proceed directly to booking
      if (!isValidAppointmentTime(details.time)) {
        appointmentBookingState.set(senderId, { stage: 'awaiting_details' });
        return "Our showroom is open 11am-7pm daily. Please choose a time within these hours.";
      }
      
      // Save appointment directly
      try {
        await saveAppointment(senderId, userInfo.name, details.date, details.time, details.phone);
        
        let confirmation = `Perfect! I've noted your visit for ${details.date} at ${details.time}. Looking forward to seeing you at our showroom! 📍 36 Jalan Kilang Barat`;
        if (details.phone) {
          confirmation += `\n\nWe'll WhatsApp you at ${details.phone} with a reminder.`;
        }
        
        await logAnalytics('appointment_booked', senderId, { date: details.date, time: details.time });
        return confirmation;
      } catch (error) {
        console.error('Error saving appointment:', error);
        return "Sorry, I couldn't save your appointment. Please try again or call us directly at +65 6019 0775.";
      }
    } else {
      // Start booking flow if date/time not provided
      appointmentBookingState.set(senderId, { stage: 'awaiting_details' });
      return "Great! When would you like to visit us? Just let me know your preferred date and time (we're open 11am-7pm daily).";
    }
  }
  
  if (state && state.stage === 'awaiting_details') {
    const details = parseAppointmentDetails(text);
    
    // Debug logging
    console.log('Appointment parsing for:', text);
    console.log('Parsed details:', details);
    
    if (!details.date || !details.time) {
      let missingInfo = [];
      if (!details.date) missingInfo.push('date');
      if (!details.time) missingInfo.push('time');
      
      return `I couldn't understand the ${missingInfo.join(' and ')}. Please try again with a clear date and time, like:\n• "Tomorrow at 2pm"\n• "Thursday 3pm"\n• "1st August at 12pm"\n\nWe're open 11am-7pm daily.`;
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

// Send showroom info with buttons
async function sendShowroomInfoWithButtons(recipientId) {
  const showroomText = `📍 Visit our showroom!
36 Jalan Kilang Barat
Singapore 598576

⏰ Open 11am-7pm daily

Free consultation for your furniture needs!`;
  
  const buttons = [
    {
      type: 'phone_number',
      title: 'Call Showroom',
      payload: '+6560190775'
    },
    {
      type: 'postback',
      title: 'Book Consultation',
      payload: 'BOOK_CONSULTATION'
    },
    {
      type: 'web_url',
      title: 'Get Directions',
      url: 'https://goo.gl/maps/your-showroom-location'
    }
  ];

  await sendButtonTemplate(recipientId, showroomText, buttons);
}

module.exports = {
  handleMessage,
  handlePostback,
  // Export for testing
  parseAppointmentDetails,
  isValidAppointmentTime
};