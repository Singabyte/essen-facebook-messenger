const axios = require('axios');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Utility function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simulate human typing speed (words per minute)
function calculateTypingDelay(text) {
  const wordsPerMinute = 60; // Average human typing speed
  const words = text.split(' ').length;
  const typingTimeMs = (words / wordsPerMinute) * 60 * 1000;
  // Add some randomness and ensure minimum/maximum bounds
  const randomFactor = 0.5 + Math.random(); // 0.5 to 1.5 multiplier
  const delayMs = Math.max(1000, Math.min(5000, typingTimeMs * randomFactor));
  return delayMs;
}

// Send typing indicator
async function sendTypingIndicator(recipientId, isTyping = true) {
  const messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: isTyping ? 'typing_on' : 'typing_off'
  };
  
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      messageData,
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
  } catch (error) {
    console.error('Error sending typing indicator:', error.response?.data);
  }
}

// Send message with human-like timing
async function sendMessageWithTyping(recipientId, messageData) {
  try {
    // Start typing indicator
    await sendTypingIndicator(recipientId, true);
    
    // Calculate typing delay based on message length
    const typingDelay = calculateTypingDelay(messageData.message?.text || '');
    await delay(typingDelay);
    
    // Send the actual message
    const response = await axios.post(
      `${FACEBOOK_API_URL}/me/messages`,
      messageData,
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    
    // Stop typing indicator
    await sendTypingIndicator(recipientId, false);
    
    return response.data;
  } catch (error) {
    console.error('Error sending message with typing:', error.response?.data);
    throw error;
  }
}

// Send split messages with intervals (for human-like conversation)
async function sendSplitMessages(recipientId, messages, intervalMs = 5000) {
  const results = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Prepare message data
    const messageData = {
      recipient: { id: recipientId },
      message: typeof message === 'string' ? { text: message } : message
    };
    
    // Send with typing simulation
    const result = await sendMessageWithTyping(recipientId, messageData);
    results.push(result);
    
    // Add interval between messages (except for the last one)
    if (i < messages.length - 1) {
      await delay(intervalMs);
    }
  }
  
  return results;
}

// Send image message
async function sendImageMessage(recipientId, imageUrl, text = null) {
  const messageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: true
        }
      }
    }
  };
  
  // Add text if provided
  if (text) {
    messageData.message.text = text;
  }
  
  return await sendMessageWithTyping(recipientId, messageData);
}

// Send template message (generic template for product showcase)
async function sendGenericTemplate(recipientId, elements) {
  const messageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements
        }
      }
    }
  };
  
  return await sendMessageWithTyping(recipientId, messageData);
}

// Handle referral from m.me links or ads
async function handleReferral(event) {
  const senderId = event.sender.id;
  const referral = event.referral || event.postback?.referral;
  
  if (!referral) return;
  
  const { ref, source, type } = referral;
  
  // Handle different referral sources
  let welcomeMessage = '';
  
  switch (source) {
    case 'SHORTLINK': // m.me link
      if (ref === 'sofa-promo') {
        welcomeMessage = `Welcome to ESSEN! 🛋️ I see you're interested in our sofa promotion!\n\nWe have amazing deals on our signature leather sofas. Would you like to:\n• View our sofa collection\n• Book a showroom visit\n• Learn about current promotions`;
      } else if (ref === 'kitchen') {
        welcomeMessage = `Welcome to ESSEN! 🍳 Looking to upgrade your kitchen?\n\nWe're the only furniture store in Singapore offering complete kitchen solutions. Let me show you:\n• Kitchen sinks & taps\n• Appliances\n• Free design consultation`;
      }
      break;
      
    case 'ADS': // Facebook/Instagram ads
      welcomeMessage = `Welcome from our ad! 🎯 Thanks for clicking through.\n\nESSEN is your one-stop solution for furniture, kitchen, and bathroom. How can I help you today?`;
      break;
      
    case 'CUSTOMER_CHAT_PLUGIN': // Website chat
      welcomeMessage = `Welcome from our website! 🌐 How can I assist you today?`;
      break;
      
    default:
      welcomeMessage = `Welcome to ESSEN Furniture! How can I help transform your home today?`;
  }
  
  return welcomeMessage;
}

// Create persistent menu for Messenger
async function setPersistentMenu() {
  const menu = {
    persistent_menu: [{
      locale: 'default',
      composer_input_disabled: false,
      call_to_actions: [
        {
          title: '📍 Showroom Details',
          type: 'postback',
          payload: 'SHOWROOM'
        },
        {
          title: '🌐 Visit Our Website',
          type: 'web_url',
          url: 'https://essen.sg'
        }
      ]
    }]
  };
  
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/messenger_profile`,
      menu,
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    console.log('Persistent menu set successfully');
  } catch (error) {
    console.error('Error setting persistent menu:', error.response?.data);
  }
}

// Set greeting for new conversations
async function setGreeting() {
  const greeting = {
    greeting: [{
      locale: 'default',
      text: 'Welcome to ESSEN Furniture Singapore! 🏠 Your Essential Living Expert. Click Get Started to begin!'
    }]
  };
  
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/messenger_profile`,
      greeting,
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    console.log('Greeting set successfully');
  } catch (error) {
    console.error('Error setting greeting:', error.response?.data);
  }
}

// Set get started button
async function setGetStarted() {
  const getStarted = {
    get_started: {
      payload: 'GET_STARTED'
    }
  };
  
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/messenger_profile`,
      getStarted,
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    console.log('Get started button set successfully');
  } catch (error) {
    console.error('Error setting get started:', error.response?.data);
  }
}

// Handle handover to human agent
async function passThreadControl(recipientId, targetAppId = '263902037430900', metadata = '') {
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/pass_thread_control`,
      {
        recipient: { id: recipientId },
        target_app_id: targetAppId, // Page Inbox app ID
        metadata: metadata
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    console.log('Thread control passed to human agent');
  } catch (error) {
    console.error('Error passing thread control:', error.response?.data);
  }
}

// Take thread control back
async function takeThreadControl(recipientId, metadata = '') {
  try {
    await axios.post(
      `${FACEBOOK_API_URL}/me/take_thread_control`,
      {
        recipient: { id: recipientId },
        metadata: metadata
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN }
      }
    );
    console.log('Thread control taken back');
  } catch (error) {
    console.error('Error taking thread control:', error.response?.data);
  }
}

// Initialize all Facebook features
async function initializeFacebookFeatures() {
  try {
    // Check if we have a valid PAGE_ACCESS_TOKEN
    if (!process.env.PAGE_ACCESS_TOKEN) {
      console.log('PAGE_ACCESS_TOKEN not found, skipping Facebook features initialization');
      return;
    }

    // Try to set up features but don't fail if they error
    try {
      await setGreeting();
    } catch (error) {
      console.log('Could not set greeting - this is normal if using a user token instead of page token');
    }

    try {
      await setGetStarted();
    } catch (error) {
      console.log('Could not set get started button - this is normal if using a user token instead of page token');
    }

    try {
      await setPersistentMenu();
    } catch (error) {
      console.log('Could not set persistent menu - this is normal if using a user token instead of page token');
    }

    console.log('Facebook features initialization attempted');
  } catch (error) {
    console.error('Error initializing Facebook features:', error);
    // Don't throw - let the bot continue running
  }
}

module.exports = {
  handleReferral,
  setPersistentMenu,
  setGreeting,
  setGetStarted,
  passThreadControl,
  takeThreadControl,
  initializeFacebookFeatures,
  // New human-like messaging functions
  sendTypingIndicator,
  sendMessageWithTyping,
  sendSplitMessages,
  sendImageMessage,
  sendGenericTemplate,
  delay,
  calculateTypingDelay
};