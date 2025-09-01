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
  
  // Log webhook headers for debugging Instagram
  console.log('Webhook headers:', {
    'x-hub-signature-256': req.headers['x-hub-signature-256'] ? 'present' : 'missing',
    'content-type': req.headers['content-type']
  });
  
  // Skip signature verification for Instagram webhooks or if explicitly disabled
  // Instagram webhooks may use different signature format
  const isInstagramWebhook = body.object === 'instagram';
  const skipVerification = process.env.SKIP_WEBHOOK_VERIFICATION === 'true' || isInstagramWebhook;
  
  if (!skipVerification && !verifyWebhookSignature(req)) {
    console.error('Invalid webhook signature');
    console.error('Expected APP_SECRET present:', !!process.env.APP_SECRET);
    return res.sendStatus(403);
  }
  
  if (isInstagramWebhook && !process.env.SKIP_WEBHOOK_VERIFICATION) {
    console.log('Note: Signature verification skipped for Instagram webhook');
  }
  
  // Check if this is an Instagram message coming through page object
  let isInstagramMessage = false;
  if (body.object === 'page' && body.entry && body.entry.length > 0) {
    // Check for Instagram-specific fields
    for (const entry of body.entry) {
      // Check if the entry ID matches Instagram Business Account
      if (entry.id === '17841467073360819' || 
          entry.id === process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
        isInstagramMessage = true;
        console.log('Detected Instagram entry by account ID:', entry.id);
      }
      
      if (entry.messaging && entry.messaging.length > 0) {
        for (const event of entry.messaging) {
          // Check if sender ID matches Instagram format or has Instagram-specific fields
          if (event.sender && event.sender.id && 
              (event.sender.id.length > 16 || // Instagram user IDs are typically 17+ digits
               event.is_instagram || 
               event.sender.id.startsWith('178') || // Instagram IDs often start with 178
               entry.id === process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
               entry.id === '17841467073360819')) { // Hard-coded Instagram Business Account ID
            isInstagramMessage = true;
            console.log('Detected Instagram message through page object - sender:', event.sender.id);
            break;
          }
        }
      }
      // Also check for Instagram 'changes' format
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === 'messages' || change.field === 'instagram_messages') {
            isInstagramMessage = true;
            console.log('Detected Instagram message through changes format');
            break;
          }
        }
      }
    }
  }
  
  // Handle both Facebook Messenger and Instagram messages
  if (body.object === 'instagram') {
    // Direct Instagram webhook
    console.log('Processing Instagram webhook (object: instagram)');
    await processInstagramMessages(body);
    res.status(200).send('EVENT_RECEIVED');
  } else if (body.object === 'page' && isInstagramMessage) {
    // Instagram message coming through page webhook
    console.log('Processing Instagram message through page webhook');
    await processInstagramMessages(body);
    res.status(200).send('EVENT_RECEIVED');
  } else if (body.object === 'page') {
    // Regular Facebook Messenger messages
    console.log('Processing Facebook Messenger webhook');
    await processFacebookMessages(body, 'facebook');
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
  console.log('Processing Instagram messages with body object:', body.object);
  
  // Validate body structure
  if (!body.entry || !Array.isArray(body.entry)) {
    console.error('Invalid Instagram webhook body - missing entry array');
    return;
  }
  
  // Instagram webhook structure can vary
  for (const entry of body.entry) {
    console.log(`Processing Instagram entry ID: ${entry.id}, Time: ${entry.time}`);
    
    // Format 1: Instagram messages in entry.messaging array (similar to Facebook)
    if (entry.messaging && entry.messaging.length > 0) {
      console.log(`Found ${entry.messaging.length} messaging events`);
      
      for (const webhookEvent of entry.messaging) {
        const senderId = webhookEvent.sender?.id;
        
        // Skip if no sender ID
        if (!senderId) {
          console.log('No sender ID found, skipping event');
          continue;
        }
        
        // Add platform information
        webhookEvent.platform = 'instagram';
        
        try {
          if (webhookEvent.message && !webhookEvent.message.is_echo) {
            // Handle Instagram message
            console.log(`Instagram message from ${senderId}:`, {
              text: webhookEvent.message.text,
              mid: webhookEvent.message.mid,
              attachments: webhookEvent.message.attachments?.length || 0
            });
            
            // Ensure all required fields are present
            if (!webhookEvent.sender || !webhookEvent.sender.id) {
              console.error('Missing sender information in Instagram webhook');
              continue;
            }
            
            // Call message handler with error boundary
            try {
              await messageHandler.handleMessage(webhookEvent);
            } catch (msgError) {
              console.error('Error in messageHandler.handleMessage:', msgError);
              console.error('Stack trace:', msgError.stack);
            }
          } else if (webhookEvent.postback) {
            // Instagram postback (from quick replies, etc.)
            console.log(`Instagram postback from ${senderId}: ${webhookEvent.postback.payload}`);
            await messageHandler.handlePostback(webhookEvent);
          } else if (webhookEvent.read) {
            // Instagram read receipt
            console.log(`Instagram message read by ${senderId}, mid: ${webhookEvent.read.mid}`);
          } else if (webhookEvent.message?.is_echo) {
            console.log(`Skipping echo message from ${senderId}`);
          }
        } catch (handlerError) {
          console.error('Instagram message handler error:', handlerError);
          console.error('Full error:', handlerError.stack);
          // Continue processing other messages
        }
      }
    }
    
    // Format 2: Instagram messages in entry.changes array (WhatsApp Business API format)
    if (entry.changes && entry.changes.length > 0) {
      console.log(`Found ${entry.changes.length} change events`);
      
      for (const change of entry.changes) {
        console.log(`Processing change field: ${change.field}`);
        
        if ((change.field === 'messages' || change.field === 'instagram_messages') && change.value) {
          // Handle Instagram Direct Messages in WhatsApp format
          const value = change.value;
          
          // Log the entire value structure for debugging
          console.log('Instagram change value structure:', JSON.stringify(value, null, 2));
          
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              // Build webhook event in standard format
              const instagramEvent = {
                sender: { 
                  id: message.from?.id || value.sender?.id,
                  username: message.from?.username || value.sender?.username
                },
                recipient: { 
                  id: value.metadata?.recipient_id || entry.id || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_ID
                },
                timestamp: parseInt(message.timestamp) * 1000,
                message: {
                  mid: message.id,
                  text: message.text?.body || message.text || '',
                  attachments: message.attachments || []
                },
                platform: 'instagram'
              };
              
              console.log(`Instagram DM from ${instagramEvent.sender.username || instagramEvent.sender.id}:`, {
                text: instagramEvent.message.text,
                attachments: instagramEvent.message.attachments.length
              });
              
              try {
                await messageHandler.handleMessage(instagramEvent);
              } catch (error) {
                console.error('Error handling Instagram DM:', error);
              }
            }
          }
          
          // Also check for other message formats
          if (value.messaging_product === 'instagram' && value.entry) {
            console.log('Found nested Instagram entry in changes');
            // Recursively process nested entries
            await processInstagramMessages({ object: 'instagram', entry: [value.entry] });
          }
        }
      }
    }
    
    // Format 3: Direct message format (some Instagram business accounts)
    if (entry.message) {
      console.log('Found direct message format');
      const instagramEvent = {
        sender: { id: entry.sender_id || entry.from?.id },
        recipient: { id: entry.recipient_id || entry.id },
        timestamp: entry.timestamp || Date.now(),
        message: {
          mid: entry.message_id || entry.id,
          text: entry.message.text || entry.text || ''
        },
        platform: 'instagram'
      };
      
      try {
        await messageHandler.handleMessage(instagramEvent);
      } catch (error) {
        console.error('Error handling direct Instagram message:', error);
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