const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const messageHandler = require('./messageHandler');
const { logAnalytics } = require('./database');

// Webhook verification endpoint
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.warn('Webhook verification failed - invalid token');
      res.sendStatus(403);
    }
  } else {
    console.warn('Webhook verification failed - missing parameters');
    res.sendStatus(400);
  }
});

// Message handling endpoint
router.post('/', async (req, res) => {
  const body = req.body;
  
  // Verify webhook signature
  if (!verifyWebhookSignature(req)) {
    console.error('Invalid webhook signature');
    return res.sendStatus(403);
  }
  
  if (body.object === 'page') {
    // Process each entry
    for (const entry of body.entry) {
      // Check if it's a standby event (another app has control)
      if (entry.standby) {
        console.log('Bot is in standby mode - Page Inbox has control');
        continue;
      }
      
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;
      
      // Check if message is from Page (not user)
      if (webhookEvent.sender.id === webhookEvent.recipient.id) {
        console.log('Ignoring message from page itself');
        continue;
      }
      
      // Check for handover protocol events
      if (webhookEvent.pass_thread_control) {
        console.log('Thread control passed to bot');
        await messageHandler.handleThreadControl(webhookEvent);
      } else if (webhookEvent.take_thread_control) {
        console.log('Thread control taken from bot');
      } else if (webhookEvent.request_thread_control) {
        console.log('Thread control requested');
      }
      
      // Log webhook event
      await logAnalytics('webhook_received', senderId, {
        type: getEventType(webhookEvent),
        timestamp: entry.time
      });
      
      // Handle different types of events
      if (webhookEvent.message && !webhookEvent.message.is_echo) {
        // Check for quick reply from Facebook's automated responses
        if (webhookEvent.message.quick_reply) {
          await messageHandler.handleQuickReply(webhookEvent);
        } else {
          await messageHandler.handleMessage(webhookEvent);
        }
      } else if (webhookEvent.postback) {
        await messageHandler.handlePostback(webhookEvent);
      } else if (webhookEvent.referral) {
        // Handle m.me links with ref parameters
        await messageHandler.handleReferral(webhookEvent);
      }
    }
    
    // Return 200 OK to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Not a page subscription
    res.sendStatus(404);
  }
});

// Verify webhook signature
function verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    console.warn('No signature found in request headers');
    return false;
  }
  
  const elements = signature.split('=');
  const signatureHash = elements[1];
  
  const expectedHash = crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return signatureHash === expectedHash;
}

// Get event type for analytics
function getEventType(webhookEvent) {
  if (webhookEvent.message) {
    if (webhookEvent.message.text) return 'text_message';
    if (webhookEvent.message.attachments) return 'attachment_message';
    if (webhookEvent.message.quick_reply) return 'quick_reply';
    return 'message';
  }
  if (webhookEvent.postback) return 'postback';
  if (webhookEvent.referral) return 'referral';
  if (webhookEvent.pass_thread_control) return 'thread_control_passed';
  if (webhookEvent.take_thread_control) return 'thread_control_taken';
  return 'unknown';
}

module.exports = router;