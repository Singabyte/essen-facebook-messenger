const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const messageHandler = require('./messageHandler');
const { logAnalytics } = require('./database');

// Also handle requests at root path (for DigitalOcean ingress)
router.get('/', handleWebhookVerification);
router.post('/', handleWebhookMessage);

// Webhook verification endpoint
function handleWebhookVerification(req, res) {
  console.log('Webhook GET received with params:', req.query);
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Check if this is a webhook verification request
  if (mode === 'subscribe' && token && challenge) {
    if (token === process.env.VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.warn('Webhook verification failed - invalid token');
      res.sendStatus(403);
    }
  } else if (mode || token || challenge) {
    // Partial webhook params - invalid request
    console.warn('Invalid webhook verification request - missing parameters');
    res.sendStatus(400);
  } else {
    // No webhook params - return bot status for regular GET requests
    res.status(200).json({ 
      name: 'Facebook Messenger Bot',
      status: 'Running',
      version: '1.0.0'
    });
  }
}

// Message handling endpoint
async function handleWebhookMessage(req, res) {
  console.log('Webhook POST received');
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  
  const body = req.body;
  
  // Verify webhook signature
  if (!verifyWebhookSignature(req)) {
    console.error('Invalid webhook signature');
    console.error('Debug info:', {
      hasRawBody: !!req.rawBody,
      rawBodyLength: req.rawBody?.length,
      bodyKeys: Object.keys(req.body),
      hasSignature256: !!req.headers['x-hub-signature-256'],
      hasSignature: !!req.headers['x-hub-signature'],
      appSecretSet: !!process.env.APP_SECRET
    });
    
    // Temporary: Allow messages through if APP_SECRET is not set (development only)
    if (!process.env.APP_SECRET) {
      console.warn('⚠️  APP_SECRET not set - bypassing signature verification (UNSAFE!)');
    } else {
      return res.sendStatus(403);
    }
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
}

// Verify webhook signature
function verifyWebhookSignature(req) {
  // Facebook sends both SHA1 and SHA256 signatures
  const sha256Signature = req.headers['x-hub-signature-256'];
  const sha1Signature = req.headers['x-hub-signature'];
  
  if (!sha256Signature && !sha1Signature) {
    console.warn('No signature found in request headers');
    console.warn('Headers:', JSON.stringify(req.headers));
    return false;
  }
  
  // Use raw body if available, otherwise stringify the parsed body
  const bodyToVerify = req.rawBody || JSON.stringify(req.body);
  
  // Try SHA256 first (newer)
  if (sha256Signature) {
    const elements = sha256Signature.split('=');
    const signatureHash = elements[1];
    
    const expectedHash = crypto
      .createHmac('sha256', process.env.APP_SECRET)
      .update(bodyToVerify)
      .digest('hex');
    
    if (signatureHash === expectedHash) {
      return true;
    }
  }
  
  // Fallback to SHA1 (older)
  if (sha1Signature) {
    const elements = sha1Signature.split('=');
    const signatureHash = elements[1];
    
    const expectedHash = crypto
      .createHmac('sha1', process.env.APP_SECRET)
      .update(bodyToVerify)
      .digest('hex');
    
    if (signatureHash === expectedHash) {
      return true;
    }
  }
  
  // Debug logging if both fail
  console.error('Signature verification failed:');
  console.error('SHA256 signature:', sha256Signature);
  console.error('SHA1 signature:', sha1Signature);
  console.error('APP_SECRET exists:', !!process.env.APP_SECRET);
  console.error('APP_SECRET length:', process.env.APP_SECRET?.length);
  console.error('Body type:', typeof bodyToVerify);
  console.error('Body length:', bodyToVerify.length);
  console.error('First 100 chars of body:', bodyToVerify.substring(0, 100));
  
  return false;
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