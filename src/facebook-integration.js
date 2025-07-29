const axios = require('axios');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

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
  await setGreeting();
  await setGetStarted();
  await setPersistentMenu();
  console.log('Facebook features initialized');
}

module.exports = {
  handleReferral,
  setPersistentMenu,
  setGreeting,
  setGetStarted,
  passThreadControl,
  takeThreadControl,
  initializeFacebookFeatures
};