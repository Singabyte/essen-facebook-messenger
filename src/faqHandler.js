const { db } = require('./database-pg');
const { 
  sendSplitMessages, 
  sendQuickReply,
  delay 
} = require('./facebook-integration');

// FAQ matching confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4
};

/**
 * Calculate similarity between two strings using Jaccard similarity
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Extract keywords from user message for better matching
 */
function extractKeywords(message) {
  // Remove common stop words and extract meaningful keywords
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'what', 'how', 'when',
    'where', 'why', 'who', 'which', 'that', 'this', 'these', 'those'
  ]);
  
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Check if message is likely an FAQ inquiry
 */
function isFAQInquiry(message) {
  const faqIndicators = [
    'what', 'how', 'when', 'where', 'why', 'who', 'which',
    'can you', 'do you', 'is it', 'are you', 'does',
    'tell me', 'explain', 'help', 'information',
    '?', // Questions usually have question marks
  ];
  
  const messageWords = message.toLowerCase().split(/\s+/);
  const hasIndicator = faqIndicators.some(indicator => 
    message.toLowerCase().includes(indicator)
  );
  
  // Also check for question structure
  const hasQuestionStructure = message.includes('?') || 
    messageWords.some(word => ['what', 'how', 'when', 'where', 'why', 'who'].includes(word));
  
  return hasIndicator || hasQuestionStructure;
}

/**
 * Find matching FAQs for a user message
 */
async function findMatchingFAQs(message, limit = 5) {
  try {
    // First, try exact keyword matching from database
    const keywords = extractKeywords(message);
    const keywordResults = [];
    
    if (keywords.length > 0) {
      // Search using database query for better performance
      const dbResults = await db.searchFAQs(message, limit);
      keywordResults.push(...dbResults);
    }
    
    // If no good matches, get all FAQs and compute similarity
    if (keywordResults.length === 0) {
      const allFAQs = await db.getActiveFAQs();
      
      // Calculate similarity for each FAQ
      const scoredFAQs = allFAQs.map(faq => {
        const questionSimilarity = calculateSimilarity(message, faq.question);
        const keywordSimilarity = faq.keywords ? 
          calculateSimilarity(message, faq.keywords) : 0;
        
        // Weighted score: question gets more weight than keywords
        const score = (questionSimilarity * 0.7) + (keywordSimilarity * 0.3);
        
        return {
          ...faq,
          similarity_score: score,
          relevance_score: Math.round(score * 100) // Convert to percentage
        };
      });
      
      // Sort by similarity and filter by threshold
      const filteredFAQs = scoredFAQs
        .filter(faq => faq.similarity_score >= CONFIDENCE_THRESHOLDS.LOW)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);
      
      keywordResults.push(...filteredFAQs);
    }
    
    return keywordResults;
  } catch (error) {
    console.error('Error finding matching FAQs:', error);
    return [];
  }
}

/**
 * Get confidence level based on similarity score
 */
function getConfidenceLevel(score) {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Handle FAQ inquiry and provide appropriate response
 */
async function handleFAQInquiry(senderId, message) {
  try {
    // Check if FAQ matching is enabled
    const faqConfig = await db.getBotConfig('faq_matching_enabled');
    if (!faqConfig || faqConfig.value !== '1') {
      return null; // FAQ matching disabled
    }
    
    // Check if this looks like an FAQ
    if (!isFAQInquiry(message)) {
      return null;
    }
    
    // Find matching FAQs
    const matchingFAQs = await findMatchingFAQs(message, 3);
    
    if (matchingFAQs.length === 0) {
      return null; // No matches found
    }
    
    const bestMatch = matchingFAQs[0];
    const confidence = getConfidenceLevel(bestMatch.relevance_score || bestMatch.similarity_score || 0);
    
    // Log FAQ usage
    await db.logFAQUsage(bestMatch.id, senderId, message);
    
    // Handle response based on confidence level
    if (confidence === 'high') {
      // High confidence - provide direct answer
      await sendDirectFAQResponse(senderId, bestMatch, matchingFAQs.slice(1));
      return {
        handled: true,
        faq_id: bestMatch.id,
        confidence: confidence,
        response_type: 'direct'
      };
      
    } else if (confidence === 'medium') {
      // Medium confidence - ask for confirmation
      await sendConfirmationFAQResponse(senderId, bestMatch, matchingFAQs);
      return {
        handled: true,
        faq_id: bestMatch.id,
        confidence: confidence,
        response_type: 'confirmation'
      };
      
    } else {
      // Low confidence - provide multiple options
      await sendMultipleFAQOptions(senderId, matchingFAQs.slice(0, 3));
      return {
        handled: true,
        confidence: confidence,
        response_type: 'options'
      };
    }
    
  } catch (error) {
    console.error('Error handling FAQ inquiry:', error);
    return null;
  }
}

/**
 * Send direct FAQ response for high confidence matches
 */
async function sendDirectFAQResponse(senderId, faq, alternatives = []) {
  try {
    // Send the answer directly
    await sendSplitMessages(senderId, [faq.answer], 3000);
    
    // Add related questions as quick replies if available
    if (alternatives.length > 0) {
      await delay(2000);
      
      const quickReplies = alternatives.slice(0, 2).map(alt => ({
        content_type: 'text',
        title: alt.question.substring(0, 20) + '...',
        payload: `FAQ_${alt.id}`
      }));
      
      quickReplies.push({
        content_type: 'text',
        title: 'More help',
        payload: 'NEED_MORE_HELP'
      });
      
      await sendQuickReply(senderId, 'Was this helpful? Here are some related questions:', quickReplies);
    }
    
  } catch (error) {
    console.error('Error sending direct FAQ response:', error);
  }
}

/**
 * Send confirmation request for medium confidence matches
 */
async function sendConfirmationFAQResponse(senderId, faq, alternatives = []) {
  try {
    const confirmationText = `I think you're asking about: "${faq.question}"\n\nIs this what you wanted to know?`;
    
    const quickReplies = [
      {
        content_type: 'text',
        title: 'Yes, that\'s it',
        payload: `FAQ_CONFIRM_${faq.id}`
      },
      {
        content_type: 'text',
        title: 'No, something else',
        payload: 'FAQ_OTHER_OPTIONS'
      }
    ];
    
    if (alternatives.length > 1) {
      quickReplies.push({
        content_type: 'text',
        title: 'Show other options',
        payload: 'FAQ_SHOW_MORE'
      });
    }
    
    await sendQuickReply(senderId, confirmationText, quickReplies);
    
  } catch (error) {
    console.error('Error sending confirmation FAQ response:', error);
  }
}

/**
 * Send multiple FAQ options for low confidence matches
 */
async function sendMultipleFAQOptions(senderId, faqs) {
  try {
    if (faqs.length === 0) return;
    
    const optionsText = 'I found a few possible answers to your question. Which one interests you?';
    
    const quickReplies = faqs.map((faq, index) => ({
      content_type: 'text',
      title: `${index + 1}. ${faq.question.substring(0, 15)}...`,
      payload: `FAQ_SELECT_${faq.id}`
    }));
    
    quickReplies.push({
      content_type: 'text',
      title: 'None of these',
      payload: 'FAQ_NONE_MATCH'
    });
    
    await sendQuickReply(senderId, optionsText, quickReplies);
    
  } catch (error) {
    console.error('Error sending multiple FAQ options:', error);
  }
}

/**
 * Handle FAQ quick reply selections
 */
async function handleFAQQuickReply(senderId, payload) {
  try {
    if (payload.startsWith('FAQ_CONFIRM_')) {
      const faqId = payload.replace('FAQ_CONFIRM_', '');
      const faq = await db.getFAQById(faqId);
      
      if (faq) {
        await sendSplitMessages(senderId, [faq.answer], 3000);
        await delay(2000);
        await sendQuickReply(senderId, 'Hope that helps! Anything else I can assist with?', [
          'Visit showroom',
          'View products',
          'Book consultation'
        ]);
        return true;
      }
      
    } else if (payload.startsWith('FAQ_SELECT_')) {
      const faqId = payload.replace('FAQ_SELECT_', '');
      const faq = await db.getFAQById(faqId);
      
      if (faq) {
        await sendSplitMessages(senderId, [faq.answer], 3000);
        return true;
      }
      
    } else if (payload === 'FAQ_OTHER_OPTIONS') {
      await sendSplitMessages(senderId, [
        'No problem! Let me help you find what you\'re looking for.',
        'You can ask me about our products, showroom location, or book a consultation!'
      ], 3000);
      return true;
      
    } else if (payload === 'FAQ_SHOW_MORE') {
      await sendSplitMessages(senderId, [
        'Let me connect you with our team for more detailed assistance.',
        'You can call our showroom at +65 6019 0775 or visit us directly!'
      ], 3000);
      return true;
      
    } else if (payload === 'FAQ_NONE_MATCH') {
      await sendSplitMessages(senderId, [
        'I understand these options didn\'t match what you were looking for.',
        'Feel free to ask your question in a different way, or visit our showroom for personalized help!'
      ], 3000);
      return true;
      
    } else if (payload === 'NEED_MORE_HELP') {
      await sendQuickReply(senderId, 'How else can I help you today?', [
        'Visit showroom',
        'View products', 
        'Book consultation',
        'Speak to human'
      ]);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error handling FAQ quick reply:', error);
    return false;
  }
}

/**
 * Get FAQ analytics for admin interface
 */
async function getFAQAnalytics(days = 30) {
  try {
    const result = await db.query(`
      SELECT 
        f.id,
        f.question,
        f.category,
        COUNT(fu.id) as usage_count,
        COUNT(DISTINCT fu.user_id) as unique_users,
        MAX(fu.asked_at) as last_used
      FROM faqs f
      LEFT JOIN faq_usage fu ON f.id = fu.faq_id
      WHERE fu.asked_at >= NOW() - INTERVAL '${days} days' OR fu.asked_at IS NULL
      GROUP BY f.id, f.question, f.category
      ORDER BY usage_count DESC, f.created_at DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting FAQ analytics:', error);
    return [];
  }
}

module.exports = {
  handleFAQInquiry,
  handleFAQQuickReply,
  findMatchingFAQs,
  isFAQInquiry,
  getFAQAnalytics,
  calculateSimilarity,
  extractKeywords
};