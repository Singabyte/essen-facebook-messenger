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
  
  // Handle both Facebook Messenger and Instagram messages
  if (body.object === 'page') {
    // Facebook Messenger messages
    await processFacebookMessages(body, 'facebook');
    res.status(200).send('EVENT_RECEIVED');
  } else if (body.object === 'instagram') {
    // Instagram messages
    await processInstagramMessages(body);
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Not a supported subscription
    console.log(`Unsupported webhook object type: ${body.object}`);
    res.sendStatus(404);
  }
}

// Process Facebook Messenger messages
async function processFacebookMessages(body, platform = 'facebook') {
  // Process each entry
  for (const entry of body.entry) {
    console.log(`Processing Facebook entry with ${entry.messaging.length} messaging events`);
    
    // Process ALL messaging events
    for (const webhookEvent of entry.messaging) {
      const senderId = webhookEvent.sender.id;
      
      // Check if message is from Page itself (echo)
      if (webhookEvent.sender.id === webhookEvent.recipient.id) {
        console.log('Ignoring message from page itself');
        continue;
      }
      
      // Add platform information to the event
      webhookEvent.platform = platform;
      
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
}

// Process Instagram messages
async function processInstagramMessages(body) {
  // Instagram webhook structure is similar but with some differences
  for (const entry of body.entry) {
    console.log(`Processing Instagram entry`);
    
    // Instagram messages come in entry.messaging array (similar to Facebook)
    if (entry.messaging && entry.messaging.length > 0) {
      for (const webhookEvent of entry.messaging) {
        const senderId = webhookEvent.sender.id;
        
        // Add platform information
        webhookEvent.platform = 'instagram';
        
        try {
          if (webhookEvent.message && !webhookEvent.message.is_echo) {
            // Handle Instagram message
            console.log(`Instagram message from ${senderId}: ${webhookEvent.message.text}`);
            await messageHandler.handleMessage(webhookEvent);
          } else if (webhookEvent.postback) {
            // Instagram postback (from quick replies, etc.)
            await messageHandler.handlePostback(webhookEvent);
          }
        } catch (handlerError) {
          console.error('Instagram message handler error:', handlerError);
          // Continue processing
        }
      }
    }
    
    // Instagram may also have 'changes' array for other events
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value) {
          // Handle Instagram Direct Messages
          const value = change.value;
          
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const instagramEvent = {
                sender: { id: message.from.id },
                recipient: { id: value.metadata.recipient_id || entry.id },
                timestamp: parseInt(message.timestamp) * 1000,
                message: {
                  mid: message.id,
                  text: message.text?.body || ''
                },
                platform: 'instagram'
              };
              
              console.log(`Instagram DM from ${message.from.username || message.from.id}: ${message.text?.body}`);
              
              try {
                await messageHandler.handleMessage(instagramEvent);
              } catch (error) {
                console.error('Error handling Instagram DM:', error);
              }
            }
          }
        }
      }
    }
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