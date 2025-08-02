const { 
  sendSplitMessages, 
  delay 
} = require('./facebook-integration');
const { logAnalytics, getConversationHistory, getUser } = require('./database-pg').db;

// Track conversation states and timing
const conversationStates = new Map();

// Follow-up sequences for different scenarios
const FOLLOW_UP_SEQUENCES = {
  new_customer: {
    delay: 600000, // 10 minutes
    messages: [
      "Hi again! Just wondering - are you currently doing any home renovations?",
      "We help many customers with full home makeovers, from living room to kitchen to bathroom!"
    ],
    triggers: ['first_visit'],
    next_sequence: 'renovation_interest'
  },
  
  renovation_interest: {
    delay: 900000, // 15 minutes
    messages: [
      "Renovations can be quite overwhelming right?",
      "That's why many customers love our one-stop service - furniture, kitchen, and bathroom all in one place!",
      "Would you like a free consultation to plan everything out?"
    ],
    triggers: ['renovation_mentioned', 'multiple_categories'],
    next_sequence: 'consultation_offer'
  },
  
  product_browser: {
    delay: 480000, // 8 minutes
    messages: [
      "Saw something you like? 😊",
      "Many customers prefer to see and feel the quality in person before deciding.",
      "Our showroom has everything displayed beautifully - much easier to visualize in your home!"
    ],
    triggers: ['product_inquiry', 'category_browsing'],
    next_sequence: 'showroom_invitation'
  },
  
  showroom_invitation: {
    delay: 1200000, // 20 minutes
    messages: [
      "By the way, weekday mornings are usually quieter if you prefer a more relaxed browsing experience!",
      "Our consultants can give you their full attention and really help you plan everything out."
    ],
    triggers: ['showroom_mentioned'],
    next_sequence: null
  },
  
  price_inquirer: {
    delay: 720000, // 12 minutes
    messages: [
      "I know pricing is important when planning your budget!",
      "Good news is we have options for every budget, and our consultants can help you prioritize what's most important.",
      "Plus we often have package deals that save you money compared to buying separately!"
    ],
    triggers: ['price_mentioned'],
    next_sequence: 'package_deals'
  },
  
  package_deals: {
    delay: 600000, // 10 minutes
    messages: [
      "Actually, many customers are surprised by how much they save with our packages!",
      "For example, dining set + living room furniture together often costs less than buying separately.",
      "Want to explore what package options might work for your space?"
    ],
    triggers: ['savings_interest'],
    next_sequence: null
  }
};

// Keywords that trigger different conversation paths
const CONVERSATION_TRIGGERS = {
  renovation_mentioned: ['renovation', 'renovate', 'reno', 'upgrading', 'makeover', 'redo'],
  price_mentioned: ['price', 'cost', 'budget', 'expensive', 'cheap', 'how much'],
  showroom_mentioned: ['showroom', 'visit', 'see', 'location', 'address'],
  product_inquiry: ['sofa', 'table', 'bed', 'kitchen', 'bathroom', 'furniture'],
  multiple_categories: [], // Detected when user asks about 2+ categories
  first_visit: [], // Detected from conversation history
  category_browsing: ['show me', 'view', 'browse', 'look at', 'see options'],
  savings_interest: ['save', 'savings', 'package', 'deal', 'promotion']
};

// Initialize conversation tracking for a user
function initializeConversationTracking(senderId) {
  conversationStates.set(senderId, {
    startTime: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    categoriesInquired: new Set(),
    triggers: new Set(),
    currentSequence: null,
    followUpScheduled: false,
    interests: [],
    urgencyLevel: 'normal'
  });
}

// Update conversation state
function updateConversationState(senderId, message, botResponse) {
  let state = conversationStates.get(senderId);
  
  if (!state) {
    initializeConversationTracking(senderId);
    state = conversationStates.get(senderId);
  }
  
  // Update basic tracking
  state.lastActivity = Date.now();
  state.messageCount++;
  
  // Detect conversation triggers
  const triggers = detectTriggers(message.toLowerCase());
  triggers.forEach(trigger => state.triggers.add(trigger));
  
  // Detect product categories
  const categories = detectCategories(message.toLowerCase());
  categories.forEach(cat => state.categoriesInquired.add(cat));
  
  // Detect urgency level
  state.urgencyLevel = detectUrgencyLevel(message.toLowerCase());
  
  // Update interests based on conversation
  updateInterests(state, message, botResponse);
  
  // Check for multiple categories (trigger for comprehensive consultation)
  if (state.categoriesInquired.size >= 2) {
    state.triggers.add('multiple_categories');
  }
  
  // Schedule appropriate follow-up if not already scheduled
  if (!state.followUpScheduled) {
    scheduleNextFollowUp(senderId, state);
  }
}

// Detect conversation triggers from message
function detectTriggers(message) {
  const triggers = [];
  
  for (const [triggerName, keywords] of Object.entries(CONVERSATION_TRIGGERS)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      triggers.push(triggerName);
    }
  }
  
  return triggers;
}

// Detect product categories mentioned
function detectCategories(message) {
  const categories = [];
  const categoryKeywords = {
    living: ['sofa', 'couch', 'coffee table', 'tv console', 'living room'],
    dining: ['dining table', 'dining set', 'chair', 'dining room'],
    bedroom: ['bed', 'mattress', 'wardrobe', 'bedframe', 'bedroom'],
    kitchen: ['kitchen', 'sink', 'tap', 'faucet', 'appliance'],
    bathroom: ['bathroom', 'toilet', 'basin', 'shower', 'wc']
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      categories.push(category);
    }
  }
  
  return categories;
}

// Detect urgency level
function detectUrgencyLevel(message) {
  const urgentKeywords = ['urgent', 'asap', 'quickly', 'immediate', 'soon', 'deadline'];
  const relaxedKeywords = ['browsing', 'looking around', 'just checking', 'maybe', 'thinking'];
  
  if (urgentKeywords.some(keyword => message.includes(keyword))) {
    return 'high';
  }
  
  if (relaxedKeywords.some(keyword => message.includes(keyword))) {
    return 'low';
  }
  
  return 'normal';
}

// Update user interests based on conversation
function updateInterests(state, message, botResponse) {
  const message_lower = message.toLowerCase();
  
  // Detect specific interests
  if (message_lower.includes('leather') || message_lower.includes('premium')) {
    state.interests.push('premium_materials');
  }
  
  if (message_lower.includes('space') || message_lower.includes('small') || message_lower.includes('hdb')) {
    state.interests.push('space_optimization');
  }
  
  if (message_lower.includes('modern') || message_lower.includes('contemporary')) {
    state.interests.push('modern_design');
  }
  
  if (message_lower.includes('budget') || message_lower.includes('affordable')) {
    state.interests.push('budget_conscious');
  }
  
  // Remove duplicates
  state.interests = [...new Set(state.interests)];
}

// Schedule the next appropriate follow-up
function scheduleNextFollowUp(senderId, state) {
  // Determine which sequence to trigger based on conversation state
  let sequenceKey = null;
  
  // Check conversation history for first visit
  if (state.messageCount <= 3) {
    state.triggers.add('first_visit');
  }
  
  // Priority order for sequences
  const sequencePriority = [
    'renovation_interest',
    'price_inquirer', 
    'product_browser',
    'new_customer'
  ];
  
  for (const seqKey of sequencePriority) {
    const sequence = FOLLOW_UP_SEQUENCES[seqKey];
    if (sequence.triggers.some(trigger => state.triggers.has(trigger))) {
      sequenceKey = seqKey;
      break;
    }
  }
  
  if (sequenceKey) {
    state.followUpScheduled = true;
    state.currentSequence = sequenceKey;
    
    const sequence = FOLLOW_UP_SEQUENCES[sequenceKey];
    
    setTimeout(async () => {
      await executeFollowUpSequence(senderId, sequenceKey);
    }, sequence.delay);
  }
}

// Execute a follow-up sequence
async function executeFollowUpSequence(senderId, sequenceKey) {
  try {
    const sequence = FOLLOW_UP_SEQUENCES[sequenceKey];
    const state = conversationStates.get(senderId);
    
    if (!state || !sequence) return;
    
    // Check if user is still inactive (hasn't sent messages recently)
    const timeSinceLastActivity = Date.now() - state.lastActivity;
    if (timeSinceLastActivity < sequence.delay * 0.8) {
      // User became active again, skip this follow-up
      return;
    }
    
    // Send follow-up messages
    await sendSplitMessages(senderId, sequence.messages, 6000);
    
    // Log follow-up sent
    await logAnalytics('proactive_followup', senderId, { 
      sequence: sequenceKey,
      message_count: state.messageCount,
      categories_inquired: Array.from(state.categoriesInquired)
    });
    
    // Schedule next sequence if available
    if (sequence.next_sequence) {
      state.currentSequence = sequence.next_sequence;
      state.followUpScheduled = false; // Allow next sequence to be scheduled
      scheduleNextFollowUp(senderId, state);
    }
    
  } catch (error) {
    console.error('Error executing follow-up sequence:', error);
  }
}

// Check if user needs human intervention
function needsHumanIntervention(senderId, message) {
  const state = conversationStates.get(senderId);
  if (!state) return false;
  
  // Complex query indicators
  const complexKeywords = [
    'complaint', 'problem', 'issue', 'wrong', 'defect', 'broken',
    'refund', 'return', 'cancel', 'manager', 'speak to someone',
    'not satisfied', 'disappointed', 'poor quality', 'terrible'
  ];
  
  // Multiple failed attempts
  const confusionKeywords = [
    'don\'t understand', 'confused', 'not clear', 'explain again',
    'what do you mean', 'i don\'t get it', 'clarify'
  ];
  
  const message_lower = message.toLowerCase();
  
  // Check for complaint/issue keywords
  if (complexKeywords.some(keyword => message_lower.includes(keyword))) {
    return {
      reason: 'complaint_detected',
      urgency: 'high',
      message: 'Let me connect you with our customer service team who can assist you better.'
    };
  }
  
  // Check for confusion after multiple messages
  if (state.messageCount > 5 && confusionKeywords.some(keyword => message_lower.includes(keyword))) {
    return {
      reason: 'confusion_detected',
      urgency: 'medium',
      message: 'I think it would be better if you speak directly with our consultant. Let me arrange that for you.'
    };
  }
  
  // Check for highly technical or specific requests
  const technicalKeywords = [
    'installation', 'warranty terms', 'specific measurements', 'delivery schedule',
    'custom order', 'special request', 'modification'
  ];
  
  if (technicalKeywords.some(keyword => message_lower.includes(keyword))) {
    return {
      reason: 'technical_query',
      urgency: 'medium',
      message: 'For detailed technical information, our showroom consultants would be the best to help you.'
    };
  }
  
  return false;
}

// Get conversation insights for admin dashboard
function getConversationInsights(senderId) {
  const state = conversationStates.get(senderId);
  
  if (!state) return null;
  
  return {
    duration: Date.now() - state.startTime,
    messageCount: state.messageCount,
    categoriesInquired: Array.from(state.categoriesInquired),
    interests: state.interests,
    urgencyLevel: state.urgencyLevel,
    currentSequence: state.currentSequence,
    triggers: Array.from(state.triggers),
    lastActivity: state.lastActivity
  };
}

// Clean up old conversation states (run periodically)
function cleanupConversationStates() {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  for (const [senderId, state] of conversationStates.entries()) {
    if (state.lastActivity < oneDayAgo) {
      conversationStates.delete(senderId);
    }
  }
}

// Schedule periodic cleanup
setInterval(cleanupConversationStates, 60 * 60 * 1000); // Every hour

module.exports = {
  initializeConversationTracking,
  updateConversationState,
  needsHumanIntervention,
  getConversationInsights,
  executeFollowUpSequence,
  cleanupConversationStates,
  FOLLOW_UP_SEQUENCES
};