const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Load ESSEN knowledge base
let essenKnowledge = '';
let singaporeExamples = '';

// Function to load knowledge base
function loadKnowledgeBase() {
  try {
    // Use process.cwd() to ensure we're reading from the correct directory
    const rootDir = process.cwd();
    const kbPath = path.join(rootDir, 'essen-chatbot-kb.md');
    const sgPath = path.join(rootDir, 'essen-chatbot-sg-examples.md');
    
    console.log('Loading knowledge base from:', kbPath);
    console.log('Loading Singapore examples from:', sgPath);
    
    essenKnowledge = fs.readFileSync(kbPath, 'utf8');
    singaporeExamples = fs.readFileSync(sgPath, 'utf8');
    
    console.log('Knowledge base loaded successfully at', new Date().toLocaleString());
    return true;
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    console.error('Current working directory:', process.cwd());
    console.error('Directory contents:', fs.readdirSync(process.cwd()));
    return false;
  }
}

// Initial load
loadKnowledgeBase();

// Configuration for the chat
const generationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 512,
};

// Safety settings
const safetySettings = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  }
];

// ESSEN-specific system prompt with enhanced human-like conversation
function getSystemPrompt() {
  return `You are the ESSEN Furniture Singapore customer service chatbot. You're helpful, friendly, and speak naturally like a Singaporean. Help customers with furniture, kitchen, and bathroom solutions.

CONVERSATION STYLE:
- Be conversational and natural (use "lah", "sia", "right?" occasionally)
- Show genuine interest in helping customers
- Keep responses SHORT - maximum 2-3 sentences per message
- Sound enthusiastic about ESSEN products
- Use Singapore English naturally but remain professional

GUIDELINES:
1. You represent ESSEN - "Your Essential Living Expert"
2. Be warm, helpful, and proactive
3. Encourage showroom visits naturally in conversation
4. Mention free consultation when relevant
5. We're Singapore's ONLY one-stop furniture + kitchen + bathroom retailer
6. No specific pricing - always direct to showroom for best deals
7. Create urgency when appropriate (limited stock, popular items)
8. Acknowledge customer preferences and ask follow-up questions

KEY INFO:
- Founded: July 2024
- Unique: Singapore's only one-stop furniture + kitchen + bathroom retailer
- Free design consultation available
- ONE showroom location: 36 Jalan Kilang Barat, Singapore 598576
- Open daily 11am-7pm
- 5-star Google rating

RESPONSE APPROACH:
- Start with acknowledgment of their request
- Provide helpful information
- End with a natural next step or question
- Use phrases like "Actually", "By the way", "You know what" to sound conversational
- Show excitement about helping them transform their home

KNOWLEDGE BASE:
${essenKnowledge}

SINGAPORE CONTEXT:
${singaporeExamples}`;
}

// Generate response using Gemini with enhanced conversation context
async function generateResponse(prompt, context = '', conversationInsights = null) {
  try {
    // Build the full prompt with context and insights
    let fullPrompt = getSystemPrompt() + '\n\n';
    
    if (context) {
      fullPrompt += `Previous conversation context:\n${context}\n\n`;
    }
    
    // Add conversation insights for more personalized responses
    if (conversationInsights) {
      fullPrompt += `Conversation insights:\n`;
      fullPrompt += `- Message count: ${conversationInsights.messageCount}\n`;
      fullPrompt += `- Categories inquired: ${conversationInsights.categoriesInquired.join(', ')}\n`;
      fullPrompt += `- User interests: ${conversationInsights.interests.join(', ')}\n`;
      fullPrompt += `- Urgency level: ${conversationInsights.urgencyLevel}\n\n`;
    }
    
    fullPrompt += `Customer: ${prompt}\nESSEN Assistant:`;
    
    // Use slightly higher temperature for more natural responses
    const enhancedConfig = {
      ...generationConfig,
      temperature: 0.8,
      maxOutputTokens: 256 // Shorter responses for human-like feel
    };
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: enhancedConfig,
      safetySettings,
    });
    
    const response = await result.response;
    let text = response.text();
    
    // Post-process response for more natural feel
    text = enhanceResponseNaturalness(text);
    
    return text.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Handle specific errors with more natural language
    if (error.message?.includes('API key')) {
      return 'Wah, I\'m having some technical difficulties. Better to call our showroom directly at +65 6019 0775!';
    } else if (error.message?.includes('quota')) {
      return 'Sorry lah, I\'m quite busy right now. Can try again in a bit, or just call our showroom for faster help!';
    } else if (error.message?.includes('safety')) {
      return 'Hmm, I can\'t help with that particular request. But I\'d love to help you with your furniture needs instead!';
    }
    
    return 'Aiyo, something went wrong on my end. Please try again, or better yet, visit our showroom for immediate assistance!';
  }
}

// Enhance response to sound more natural and conversational
function enhanceResponseNaturalness(text) {
  // Remove overly formal language
  text = text.replace(/I would be happy to/gi, 'I\'d love to');
  text = text.replace(/I would recommend/gi, 'I\'d suggest');
  text = text.replace(/Please feel free to/gi, 'Feel free to');
  text = text.replace(/Thank you for/gi, 'Thanks for');
  
  // Add more conversational connectors
  if (Math.random() > 0.7) {
    const connectors = ['Actually', 'By the way', 'You know what'];
    const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
    if (!text.startsWith(randomConnector)) {
      text = `${randomConnector}, ${text.charAt(0).toLowerCase() + text.slice(1)}`;
    }
  }
  
  return text;
}

// Generate response with conversation history and insights
async function generateResponseWithHistory(prompt, conversationHistory, conversationInsights = null) {
  try {
    // Format conversation history
    let context = '';
    if (conversationHistory && conversationHistory.length > 0) {
      context = conversationHistory
        .slice(-5) // Get last 5 exchanges
        .reverse() // Put in chronological order
        .map(conv => `Customer: ${conv.message}\nESSEN Assistant: ${conv.response}`)
        .join('\n\n');
    }
    
    return await generateResponse(prompt, context, conversationInsights);
  } catch (error) {
    console.error('Error generating response with history:', error);
    return await generateResponse(prompt); // Fallback to no context
  }
}

// Generate multiple response options for A/B testing or variety
async function generateResponseVariations(prompt, context = '', count = 2) {
  const variations = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const response = await generateResponse(prompt, context);
      variations.push(response);
    } catch (error) {
      console.error(`Error generating variation ${i + 1}:`, error);
    }
  }
  
  return variations;
}

// Generate contextual quick replies based on ESSEN context
async function generateQuickReplies(userMessage, botResponse) {
  try {
    const prompt = `Based on this ESSEN Furniture conversation:
Customer: ${userMessage}
ESSEN Assistant: ${botResponse}

Generate 2-3 relevant follow-up options for the customer. Consider:
- Product categories (sofas, dining, bedroom, kitchen, bathroom)
- Services (showroom visit, design consultation)
- Common concerns (delivery, warranty, customization)

Return as JSON array of strings, each under 20 characters.
Example: ["View sofas", "Book consultation", "Showroom info"]`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { ...generationConfig, temperature: 0.5 },
    });
    
    const response = await result.response;
    const text = response.text();
    
    // Try to parse JSON from response
    try {
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        const replies = JSON.parse(jsonMatch[0]);
        return replies.slice(0, 3); // Maximum 3 quick replies
      }
    } catch (e) {
      console.error('Failed to parse quick replies:', e);
    }
    
    // Default ESSEN-specific quick replies
    return ["View products", "Visit showroom", "Book consultation"];
  } catch (error) {
    console.error('Error generating quick replies:', error);
    return ["View products", "Visit showroom", "Book consultation"];
  }
}

// Get product information from knowledge base
function getProductInfo(category) {
  const categories = {
    'sofa': 'sofas',
    'dining': 'dining',
    'bedroom': 'bedroom',
    'kitchen': 'kitchen',
    'bathroom': 'bathroom'
  };
  
  // Simple extraction based on category
  const searchTerm = categories[category.toLowerCase()] || category;
  const lines = essenKnowledge.split('\n');
  const relevantInfo = [];
  
  let capturing = false;
  for (const line of lines) {
    if (line.toLowerCase().includes(searchTerm)) {
      capturing = true;
    } else if (line.startsWith('###') && capturing) {
      break;
    }
    
    if (capturing) {
      relevantInfo.push(line);
    }
  }
  
  return relevantInfo.join('\n');
}

module.exports = {
  generateResponse,
  generateResponseWithHistory,
  generateResponseVariations,
  generateQuickReplies,
  getProductInfo,
  enhanceResponseNaturalness,
  loadKnowledgeBase
};