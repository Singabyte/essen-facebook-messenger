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
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;
      
      // Log webhook event
      await logAnalytics('webhook_received', senderId, {
        type: getEventType(webhookEvent),
        timestamp: entry.time
      });
      
      // Handle different types of events
      if (webhookEvent.message) {
        // Regular message
        await messageHandler.handleMessage(webhookEvent);
      } else if (webhookEvent.postback) {
        // Postback event
        await messageHandler.handlePostback(webhookEvent);
      } else if (webhookEvent.read) {
        // Message read event
        console.log(`User ${senderId} read message`);
      } else if (webhookEvent.delivery) {
        // Message delivered event
        console.log(`Message delivered to user ${senderId}`);
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
  if (webhookEvent.read) return 'read';
  if (webhookEvent.delivery) return 'delivery';
  return 'unknown';
}

module.exports = router;