const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const messageHandler = require('./messageHandler');
// Simple webhook handler - no analytics needed

// Webhook endpoints
router.get('/', handleWebhookVerification);
router.post('/', handleWebhookMessage);

// Webhook verification endpoint
function handleWebhookVerification(req, res) {
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
    res.sendStatus(400);
  }
}

// Message handling endpoint
async function handleWebhookMessage(req, res) {
  const body = req.body;
  
  console.log(`[${new Date().toISOString()}] Webhook received:`, JSON.stringify(body, null, 2));
  
  // Verify webhook signature
  if (!verifyWebhookSignature(req)) {
    console.error('Invalid webhook signature');
    return res.sendStatus(403);
  }
  
  if (body.object === 'page') {
    // Process each entry
    for (const entry of body.entry) {
      console.log(`Processing entry with ${entry.messaging.length} messaging events`);
      
      // Process ALL messaging events, not just the first one
      for (const webhookEvent of entry.messaging) {
        const senderId = webhookEvent.sender.id;
      
      // Check if message is from Page itself (echo)
      if (webhookEvent.sender.id === webhookEvent.recipient.id) {
        console.log('Ignoring message from page itself');
        continue;
      }
      
      // Handle different types of events (with error handling)
      try {
        if (webhookEvent.message && !webhookEvent.message.is_echo) {
          // Skip echo messages
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
      } catch (handlerError) {
        console.error('Message handler error:', handlerError);
        console.error('Full error details:', {
          message: handlerError.message,
          stack: handlerError.stack,
          response: handlerError.response?.data
        });
        // Continue processing - don't let handler errors break the webhook response
      }
      }
    }
    
    // Return 200 OK to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Not a page subscription
    res.sendStatus(404);
  }
}

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
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');
  
  return signatureHash === expectedHash;
}

module.exports = router;