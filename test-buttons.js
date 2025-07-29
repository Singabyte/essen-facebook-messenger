#!/usr/bin/env node

// Test script for button template functionality
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Test the showroom button template locally
async function testShowroomButtons() {
  console.log('🧪 Testing Showroom Button Template\n');
  
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

  console.log('Message Text:');
  console.log(showroomText);
  console.log('\nButtons:');
  buttons.forEach((button, index) => {
    console.log(`${index + 1}. ${button.title} -> ${button.url}`);
  });

  console.log('\nFacebook Message Structure:');
  console.log(JSON.stringify({
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: showroomText,
        buttons: buttons
      }
    }
  }, null, 2));

  console.log('\n✅ Button template structure looks correct!');
  console.log('\nNote: To fully test, send "/showroom" command to the bot on Facebook Messenger.');
}

// Run test
testShowroomButtons();