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
  generateQuickReplies,
  getProductInfo
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
    await sendTextMessage(senderId, 'Sorry lah, I encountered an error. Please try again or visit our showroom for immediate assistance!');
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
    return getShowroomInfo();
  } else if (command === '/consultation') {
    return getConsultationInfo();
  } else if (command === '/bestsellers') {
    return getBestSellers();
  } else if (command === '/about') {
    return getAboutESSEN();
  } else if (command === '/clear') {
    return 'No problem! Let\'s start fresh. How can I help you transform your home today?';
  } else if (command === '/human' || command === '/agent') {
    // Transfer to human agent
    const { passThreadControl } = require('./facebook-integration');
    await passThreadControl(senderId, '263902037430900', 'Customer requested human agent');
    return 'I\'m connecting you with our human customer service team. They\'ll be with you shortly! 👨‍💼';
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
      return getShowroomInfo();
    case 'Free consultation':
      return getConsultationInfo();
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
        responseText = getShowroomInfo();
        break;
      default:
        responseText = `Thanks for clicking! Let me help you with: ${payload}`;
    }
    
    // Send with quick replies for get started
    if (payload === 'GET_STARTED') {
      await sendQuickReply(senderId, responseText, [
        'View products',
        'Visit showroom',
        'Free consultation'
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

// ESSEN-specific message templates

function getWelcomeMessage() {
  return `Welcome to ESSEN Furniture Singapore! 🏠

I'm here to help you transform your home with our premium furniture, kitchen, and bathroom solutions. We're your Essential Living Expert!

What brings you here today?
• Looking for furniture? (sofas, dining, bedroom)
• Need kitchen solutions? (sinks, taps, appliances)
• Bathroom renovation? (complete fixtures)
• Want free design consultation?

Just type your question or choose an option below!`;
}

function getHelpMessage() {
  return `Here's how I can help you:

🛋️ **Furniture Solutions**
Ask about sofas, dining sets, bedframes, and more

🍳 **Kitchen Solutions**
Explore sinks, taps, cooker hoods, and appliances

🚿 **Bathroom Solutions**
Discover shower systems, basins, vanities, and fixtures

📍 **Showroom Services**
• Free design consultation
• View actual displays
• Professional advice

**Quick Commands:**
/products - View all categories
/showroom - Location & hours
/consultation - Book free session
/bestsellers - Popular items

Just type your question naturally - I understand Singlish also! 😊`;
}

function getProductsMessage() {
  return `Here are our product categories:

**🛋️ Living Room**
• Sofas (Regular & Electronic)
• Coffee Tables
• Single Sofas/Accent Chairs

**🍽️ Dining Room**
• Dining Tables (Fixed & Extendable)
• Dining Chairs

**🛏️ Bedroom**
• Bedframes with storage
• ESSEN Ultra-Plus Mattresses
• Bedside tables & drawers

**🍳 Kitchen**
• Stainless Steel Sinks
• Kitchen Taps
• Cooker Hoods & Hobs

**🚿 Bathroom**
• Rain Shower Systems
• Basin Taps & Basins
• Vanity Cabinets
• Toilet Bowls

**💡 Home Comfort**
• Ceiling Fans
• Designer Lighting
• Water Heaters

Which category interests you? I can share more details!`;
}

function getShowroomInfo() {
  return `**ESSEN Furniture Showroom** 📍

Visit us for the complete ESSEN experience!

**What to Expect:**
✨ Fully furnished room displays
☕ Complimentary refreshments
👨‍💼 Expert consultants ready to help
🎯 One-stop solution for furniture + kitchen + bathroom

**Services Available:**
• FREE design consultation
• Material & fabric sampling
• Custom configuration planning
• Measurement services
• Delivery arrangement

**Why Visit?**
Can see and touch our premium materials like 4mm signature leather! Our consultants can help plan your whole home transformation.

Want to book an appointment? Weekday mornings usually more relaxed! Just let me know when you'd like to come.`;
}

function getConsultationInfo() {
  return `**FREE Design Consultation** 🎨

Our professional consultants are here to help transform your home!

**What's Included:**
• Space planning for your home
• Material and color selection
• Style recommendations
• Budget optimization
• 3D visualization (for larger projects)

**Duration:** Usually 1-2 hours

**What to Bring:**
• Floor plan (if have)
• Photos of your space
• Inspiration images
• Rough budget in mind

**Best Part:** Completely FREE! No obligation to purchase.

Many customers say this service alone is worth the visit. Our consultants really know how to maximize HDB and condo spaces!

Would you like to schedule a consultation? What's your preferred date and time?`;
}

function getBestSellers() {
  return `**ESSEN Best Sellers** 🌟

Here are what other customers love:

**Sofas:**
• Miku Extendable Electronic Sofa - Perfect for movie nights!
• Cova Modular Sofa - Flexible configuration

**Dining:**
• Cascade Dining Table - Modern sintered stone top
• Marina Dining Set - Timeless design

**Bedroom:**
• Nova Storage Bedframe - Maximum space efficiency
• ESSEN Ultra-Plus III Mattress - Premium comfort

**Kitchen:**
• SST SS-20501 Kitchen Sink - Nano coating technology
• KMT Pull-out Tap Series - Practical and stylish

**Special:**
• ESSEN Silk Design Pendant Light - Statement piece!
• 4mm Signature Leather Sofas - Exclusive to ESSEN

These items very popular - some even have waiting list! Visit our showroom to see them in person?`;
}

function getAboutESSEN() {
  return `**About ESSEN Furniture Singapore** 

🏢 **Who We Are:**
Your Essential Living Expert - the ONLY furniture retailer in Singapore offering furniture + kitchen + bathroom solutions under one roof!

📅 **Established:** July 1st, 2024

💭 **Our Philosophy:**
"Good furniture is the essence of every home; essential, timeless, and unforgettable"

⭐ **Why Choose ESSEN:**
• Premium quality at honest prices
• Free professional design consultation
• One-stop home transformation
• 5/5 Google rating from happy customers
• Exclusive 4mm signature leather
• 2-year warranty on furniture

🤝 **Partners:**
We work with interior design firms like Sense & Semblance and Saege Design for complete home solutions.

Visit our showroom to experience the ESSEN difference! Any specific questions about our company?`;
}

module.exports = {
  handleMessage,
  handlePostback
};