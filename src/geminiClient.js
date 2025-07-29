const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Load ESSEN knowledge base
let essenKnowledge = '';
let singaporeExamples = '';

try {
  essenKnowledge = fs.readFileSync(path.join(__dirname, '../essen-chatbot-kb.md'), 'utf8');
  singaporeExamples = fs.readFileSync(path.join(__dirname, '../essen-chatbot-sg-examples.md'), 'utf8');
} catch (error) {
  console.error('Error loading knowledge base:', error);
}

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

// ESSEN-specific system prompt
const SYSTEM_PROMPT = `You are the ESSEN Furniture Singapore customer service chatbot. Help customers with furniture, kitchen, and bathroom solutions.

CRITICAL: Keep responses SHORT - maximum 2-3 sentences. Get to the point quickly.

GUIDELINES:
1. You represent ESSEN - "Your Essential Living Expert"
2. Use Singapore English naturally
3. Be warm and helpful
4. Encourage showroom visits
5. Mention free consultation when relevant
6. We're the only retailer with furniture + kitchen + bathroom
7. No specific pricing - direct to showroom

KEY INFO:
- Founded: July 2024
- Unique: One-stop furniture + kitchen + bathroom
- Free design consultation available

RESPONSE STYLE:
- Maximum 2-3 sentences per response
- Direct and helpful
- Suggest next action (visit, consultation, product view)

KNOWLEDGE BASE:
${essenKnowledge}

SINGAPORE CONTEXT:
${singaporeExamples}`;

// Generate response using Gemini
async function generateResponse(prompt, context = '') {
  try {
    // Build the full prompt with context
    let fullPrompt = SYSTEM_PROMPT + '\n\n';
    
    if (context) {
      fullPrompt += `Previous conversation context:\n${context}\n\n`;
    }
    
    fullPrompt += `Customer: ${prompt}\nESSEN Assistant:`;
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig,
      safetySettings,
    });
    
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response
    return text.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Handle specific errors
    if (error.message?.includes('API key')) {
      return 'I apologize, but there seems to be a technical issue. Please contact our showroom directly for assistance.';
    } else if (error.message?.includes('quota')) {
      return 'I apologize, but I\'m currently experiencing high demand. Please try again in a moment, or feel free to call our showroom!';
    } else if (error.message?.includes('safety')) {
      return 'I apologize, but I cannot provide a response to that request. How else can I help you with your furniture needs?';
    }
    
    return 'I apologize for the inconvenience. Please try again, or visit our showroom for immediate assistance!';
  }
}

// Generate response with conversation history
async function generateResponseWithHistory(prompt, conversationHistory) {
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
    
    return await generateResponse(prompt, context);
  } catch (error) {
    console.error('Error generating response with history:', error);
    return await generateResponse(prompt); // Fallback to no context
  }
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
    return ["View products", "Visit showroom", "Free consultation"];
  } catch (error) {
    console.error('Error generating quick replies:', error);
    return ["View products", "Visit showroom", "Free consultation"];
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
  generateQuickReplies,
  getProductInfo
};