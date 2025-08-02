const { 
  sendSplitMessages, 
  sendImageMessage, 
  sendGenericTemplate,
  delay 
} = require('./facebook-integration');
const { db } = require('./database-pg');
const { logAnalytics } = db;

// Promotion categories and keywords
const PROMOTION_KEYWORDS = {
  toilet_sets: ['toilet', 'wc', 'bathroom set', 'toilet bowl', 'basin', 'toilet promotion'],
  kitchen_appliances: ['kitchen', 'sink', 'tap', 'faucet', 'kitchen set', 'appliance'],
  sofas: ['sofa', 'couch', 'living room', 'leather sofa', 'sectional'],
  dining: ['dining table', 'dining set', 'chair', 'dining room'],
  bedroom: ['bed', 'mattress', 'bedroom set', 'wardrobe', 'bedframe'],
  general_promo: ['promotion', 'promo', 'discount', 'sale', 'offer', 'deal']
};

// Static promotion templates (fallback when database templates are not available)
const PROMOTION_TEMPLATES = {
  toilet_sets: {
    messages: [
      "Great choice! Our toilet sets are very popular right now! 🚽",
      "We have complete packages - toilet bowl + basin + accessories, all matching designs.",
      "Would you like to see our current promotion packages? Much better to view in person at our showroom!"
    ],
    quick_replies: ['Toilet promotions', 'Book showroom visit', 'WhatsApp for prices'],
    follow_up_delay: 300000, // 5 minutes
    follow_up_message: "Still thinking about the toilet sets? Our design consultant can show you all the options and help you choose the perfect one for your bathroom!"
  },
  
  kitchen_appliances: {
    messages: [
      "Ah kitchen renovation! Very exciting sia! 🍳",
      "We're the only furniture store with complete kitchen solutions - sinks, taps, and everything you need.",
      "Our kitchen packages are very popular because everything matches perfectly. Want to see?"
    ],
    quick_replies: ['Kitchen packages', 'Design consultation', 'Showroom visit'],
    follow_up_delay: 420000, // 7 minutes
    follow_up_message: "Kitchen renovation is a big decision. Our consultants can help you plan the perfect layout and choose the right materials. Free consultation some more!"
  },
  
  sofas: {
    messages: [
      "Looking for sofas? Perfect timing! 🛋️",
      "Our signature leather sofas are flying off the floor. We have 2-seater, 3-seater, and L-shaped options.",
      "The quality is really shiok - many customers come back to buy for their parents' house too!"
    ],
    quick_replies: ['Sofa collection', 'Book visit', 'Check availability'],
    follow_up_delay: 480000, // 8 minutes
    follow_up_message: "Our sofas have waiting lists because they're so popular. Want to secure yours? Better to see and feel the leather quality in person!"
  },
  
  dining: {
    messages: [
      "Dining sets! Always good to upgrade for family meals! 🍽️",
      "We have solid wood tables that last forever, plus chairs that are super comfortable.",
      "Very suitable for HDB and condo - we have sizes for every space."
    ],
    quick_replies: ['Dining options', 'Space planning', 'Showroom visit'],
    follow_up_delay: 360000, // 6 minutes
    follow_up_message: "Dining sets are investment pieces. Our consultants can help you measure your space and choose the perfect size and style!"
  },
  
  general_promo: {
    messages: [
      "Yes, we have ongoing promotions! 🎉",
      "Actually better if you visit our showroom - can see everything and get the best deals.",
      "Our consultants will show you all current offers and help you mix and match for best value!"
    ],
    quick_replies: ['Current promotions', 'Book visit', 'WhatsApp deals'],
    follow_up_delay: 240000, // 4 minutes
    follow_up_message: "Promotions change regularly and some items have limited stock. Want to check what's available now?"
  }
};

/**
 * Process template content with variable substitution
 */
function processTemplateContent(template, variables = {}) {
  let content = template.content;
  let quickReplies = [];
  
  try {
    // Parse variables from template
    const templateVariables = JSON.parse(template.variables || '[]');
    
    // Substitute variables in content
    templateVariables.forEach(variable => {
      const value = variables[variable.name] || variable.default_value || `{${variable.name}}`;
      content = content.replace(
        new RegExp(`{{${variable.name}}}`, 'g'),
        value
      );
    });
    
    // Parse and process quick replies
    const templateQuickReplies = JSON.parse(template.quick_replies || '[]');
    quickReplies = templateQuickReplies.map(reply => ({
      ...reply,
      title: reply.title.replace(/{{(\w+)}}/g, (match, varName) => {
        return variables[varName] || reply.title;
      })
    }));
    
  } catch (error) {
    console.error('Error processing template:', error);
    // Fallback to original content if parsing fails
    content = template.content;
  }
  
  return {
    content,
    quickReplies,
    mediaUrl: template.media_url,
    mediaType: template.media_type
  };
}

// Detect if message is promotion-related using both keywords and database templates
async function detectPromotionInquiry(message) {
  const text = message.toLowerCase();
  
  // First check static keywords for backwards compatibility
  for (const [category, keywords] of Object.entries(PROMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  
  // Then check database templates for more dynamic matching
  try {
    const keywords = extractKeywordsFromMessage(text);
    const matchingTemplates = await db.getTemplatesByKeywords(keywords);
    
    if (matchingTemplates.length > 0) {
      return matchingTemplates[0].category;
    }
  } catch (error) {
    console.error('Error checking database templates:', error);
  }
  
  return null;
}

/**
 * Extract keywords from message for template matching
 */
function extractKeywordsFromMessage(message) {
  // Remove common words and extract meaningful keywords
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

// Handle promotion inquiry using database templates
async function handlePromotionInquiry(senderId, message, category) {
  try {
    // Log promotion inquiry
    await logAnalytics('promotion_inquiry', senderId, { 
      category,
      original_message: message 
    });
    
    // First try to get templates from database
    const dbTemplates = await db.getActiveTemplates(category);
    
    if (dbTemplates.length > 0) {
      // Use database template
      const template = dbTemplates[0]; // Use the first/most recent template
      
      // Extract user context for variable substitution
      const userContext = await extractUserContext(senderId, message);
      
      // Process template with variables
      const processedTemplate = processTemplateContent(template, userContext);
      
      // Send template content as split messages
      const messages = processedTemplate.content.split('\n').filter(msg => msg.trim());
      await sendSplitMessages(senderId, messages, 5000);
      
      // Send media if available
      if (processedTemplate.mediaUrl) {
        await delay(2000);
        await sendImageMessage(senderId, processedTemplate.mediaUrl, 'Here\'s more information! 📸');
      }
      
      // Log template usage
      await db.logTemplateUsage(template.id, senderId, message);
      
      // Get dynamic follow-up delay from bot config
      const followUpConfig = await db.getBotConfig('follow_up_delay_ms');
      const followUpDelay = followUpConfig ? parseInt(followUpConfig.value) : 300000;
      
      // Schedule follow-up message if template has one
      if (template.follow_up_message) {
        scheduleFollowUp(senderId, template.id, followUpDelay, template.follow_up_message);
      }
      
      return {
        handled: true,
        quick_replies: processedTemplate.quickReplies,
        template_id: template.id,
        source: 'database'
      };
      
    } else {
      // Fallback to static templates
      const template = PROMOTION_TEMPLATES[category];
      if (!template) {
        return null;
      }
      
      // Send split messages with human-like timing
      await sendSplitMessages(senderId, template.messages, 5000);
      
      // Schedule follow-up message
      scheduleFollowUp(senderId, category, template.follow_up_delay, template.follow_up_message);
      
      return {
        handled: true,
        quick_replies: template.quick_replies,
        source: 'static'
      };
    }
    
  } catch (error) {
    console.error('Error handling promotion inquiry:', error);
    return null;
  }
}

/**
 * Extract user context for template variable substitution
 */
async function extractUserContext(senderId, message) {
  try {
    const user = await db.getUser(senderId);
    const preferences = await db.getUserPreferences(senderId);
    
    return {
      user_name: user?.name || 'Customer',
      current_message: message,
      user_preferences: preferences,
      timestamp: new Date().toLocaleString('en-SG')
    };
  } catch (error) {
    console.error('Error extracting user context:', error);
    return {
      user_name: 'Customer',
      current_message: message,
      timestamp: new Date().toLocaleString('en-SG')
    };
  }
}

// Schedule proactive follow-up message (enhanced for database templates)
function scheduleFollowUp(senderId, templateIdOrCategory, delayMs, followUpMessage = null) {
  setTimeout(async () => {
    try {
      let messageToSend = followUpMessage;
      
      // If no follow-up message provided, try to get from static template
      if (!messageToSend && typeof templateIdOrCategory === 'string') {
        const template = PROMOTION_TEMPLATES[templateIdOrCategory];
        messageToSend = template?.follow_up_message;
      }
      
      if (messageToSend) {
        // Check if user hasn't sent any messages recently (basic check)
        // In production, you'd want to check conversation state more thoroughly
        await sendSplitMessages(senderId, [messageToSend], 0);
        
        // Log follow-up sent
        await logAnalytics('promotion_followup_sent', senderId, { 
          template_id: typeof templateIdOrCategory === 'number' ? templateIdOrCategory : null,
          category: typeof templateIdOrCategory === 'string' ? templateIdOrCategory : null
        });
      }
    } catch (error) {
      console.error('Error sending follow-up message:', error);
    }
  }, delayMs);
}

// Get product images for promotion category
function getPromotionImages(category) {
  // In production, these would be actual product image URLs
  const images = {
    toilet_sets: 'https://example.com/toilet-sets-promo.jpg',
    kitchen_appliances: 'https://example.com/kitchen-packages.jpg',
    sofas: 'https://example.com/sofa-collection.jpg',
    dining: 'https://example.com/dining-sets.jpg',
    general_promo: 'https://example.com/current-promotions.jpg'
  };
  
  return images[category] || null;
}

// Send promotion with image (enhanced for database templates)
async function sendPromotionWithImage(senderId, category) {
  try {
    // First try database templates
    const dbTemplates = await db.getActiveTemplates(category);
    
    if (dbTemplates.length > 0) {
      const template = dbTemplates[0];
      const userContext = await extractUserContext(senderId, '');
      const processedTemplate = processTemplateContent(template, userContext);
      
      // Send image if available
      if (processedTemplate.mediaUrl) {
        await sendImageMessage(senderId, processedTemplate.mediaUrl, 'Here are our current options! 📸');
        await delay(3000);
      }
      
      // Send content messages
      const messages = processedTemplate.content.split('\n').filter(msg => msg.trim());
      await sendSplitMessages(senderId, messages, 4000);
      
      // Log template usage
      await db.logTemplateUsage(template.id, senderId, `Image promotion: ${category}`);
      
      return processedTemplate.quickReplies;
    } else {
      // Fallback to static images and templates
      const imageUrl = getPromotionImages(category);
      
      if (imageUrl) {
        await sendImageMessage(senderId, imageUrl, 'Here are our current options! 📸');
        await delay(3000);
      }
      
      const template = PROMOTION_TEMPLATES[category];
      if (template) {
        await sendSplitMessages(senderId, template.messages, 4000);
        return template.quick_replies;
      }
    }
    
  } catch (error) {
    console.error('Error sending promotion with image:', error);
    return [];
  }
}

// Create product showcase template
async function sendProductShowcase(senderId, category) {
  try {
    let elements = [];
    
    switch (category) {
      case 'sofas':
        elements = [
          {
            title: "Miku Electronic Sofa",
            subtitle: "Premium leather with electric recline",
            image_url: "https://example.com/miku-sofa.jpg",
            buttons: [
              {
                type: "postback",
                title: "Learn More",
                payload: "PRODUCT_MIKU_SOFA"
              },
              {
                type: "postback",
                title: "Book Visit",
                payload: "BOOK_VISIT_SOFA"
              }
            ]
          },
          {
            title: "4mm Leather Collection",
            subtitle: "Thick leather, exceptional comfort",
            image_url: "https://example.com/leather-collection.jpg",
            buttons: [
              {
                type: "postback",
                title: "View Collection",
                payload: "PRODUCT_LEATHER_COLLECTION"
              }
            ]
          }
        ];
        break;
        
      case 'kitchen_appliances':
        elements = [
          {
            title: "Complete Kitchen Package",
            subtitle: "Sink + Tap + Accessories",
            image_url: "https://example.com/kitchen-package.jpg",
            buttons: [
              {
                type: "postback",
                title: "View Packages",
                payload: "KITCHEN_PACKAGES"
              },
              {
                type: "postback",
                title: "Free Consultation",
                payload: "KITCHEN_CONSULTATION"
              }
            ]
          }
        ];
        break;
    }
    
    if (elements.length > 0) {
      await sendGenericTemplate(senderId, elements);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error sending product showcase:', error);
    return false;
  }
}

// Analyze message sentiment and urgency
function analyzePromotionUrgency(message) {
  const urgentKeywords = ['urgent', 'asap', 'quickly', 'immediate', 'today', 'now'];
  const priceKeywords = ['price', 'cost', 'how much', 'budget', 'cheap', 'expensive'];
  const comparisonKeywords = ['compare', 'vs', 'versus', 'better', 'difference'];
  
  const text = message.toLowerCase();
  
  return {
    urgent: urgentKeywords.some(keyword => text.includes(keyword)),
    price_focused: priceKeywords.some(keyword => text.includes(keyword)),
    comparison_seeking: comparisonKeywords.some(keyword => text.includes(keyword))
  };
}

// Get contextual follow-up questions
function getContextualFollowUp(category, urgency) {
  const followUps = {
    toilet_sets: {
      urgent: "Need toilet sets urgently? We have ready stock for immediate delivery!",
      price_focused: "Our toilet packages start from very reasonable prices. Better to see the quality in person!",
      comparison_seeking: "Want to compare different toilet set styles? Our showroom has everything displayed side by side!"
    },
    kitchen_appliances: {
      urgent: "Renovation deadline coming up? We can expedite your kitchen package!",
      price_focused: "Kitchen packages offer the best value - everything matches and costs less than buying separately!",
      comparison_seeking: "Our consultants can show you different sink and tap combinations to find your perfect match!"
    }
  };
  
  const categoryFollowUps = followUps[category];
  if (!categoryFollowUps) return null;
  
  if (urgency.urgent) return categoryFollowUps.urgent;
  if (urgency.price_focused) return categoryFollowUps.price_focused;
  if (urgency.comparison_seeking) return categoryFollowUps.comparison_seeking;
  
  return null;
}

/**
 * Get template by ID for admin interface testing
 */
async function getTemplateById(templateId) {
  try {
    return await db.getTemplateById(templateId);
  } catch (error) {
    console.error('Error getting template by ID:', error);
    return null;
  }
}

/**
 * Test template with sample variables
 */
async function testTemplate(templateId, testVariables = {}) {
  try {
    const template = await db.getTemplateById(templateId);
    if (!template) {
      return null;
    }
    
    const processedTemplate = processTemplateContent(template, testVariables);
    
    return {
      template_id: templateId,
      original_content: template.content,
      processed_content: processedTemplate.content,
      quick_replies: processedTemplate.quickReplies,
      media_url: processedTemplate.mediaUrl,
      variables_used: JSON.parse(template.variables || '[]'),
      test_variables: testVariables
    };
  } catch (error) {
    console.error('Error testing template:', error);
    return null;
  }
}

module.exports = {
  detectPromotionInquiry,
  handlePromotionInquiry,
  sendPromotionWithImage,
  sendProductShowcase,
  analyzePromotionUrgency,
  getContextualFollowUp,
  processTemplateContent,
  extractUserContext,
  getTemplateById,
  testTemplate,
  PROMOTION_KEYWORDS,
  PROMOTION_TEMPLATES
};