const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Configuration for the chat
const generationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
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

// System prompt for the bot
const SYSTEM_PROMPT = `You are a helpful and friendly Facebook Messenger bot assistant. 
Keep your responses conversational, helpful, and concise. 
If asked about yourself, you can mention you're powered by Google's Gemini AI.
Always be respectful and appropriate in your responses.`;

// Generate response using Gemini
async function generateResponse(prompt, context = '') {
  try {
    // Build the full prompt with context
    let fullPrompt = SYSTEM_PROMPT + '\n\n';
    
    if (context) {
      fullPrompt += `Previous conversation context:\n${context}\n\n`;
    }
    
    fullPrompt += `User: ${prompt}\nAssistant:`;
    
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
      return 'I apologize, but there seems to be a configuration issue. Please contact the administrator.';
    } else if (error.message?.includes('quota')) {
      return 'I apologize, but I\'m currently experiencing high demand. Please try again in a moment.';
    } else if (error.message?.includes('safety')) {
      return 'I apologize, but I cannot provide a response to that request.';
    }
    
    return 'I apologize, but I encountered an error. Please try again later.';
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
        .map(conv => `User: ${conv.message}\nAssistant: ${conv.response}`)
        .join('\n\n');
    }
    
    return await generateResponse(prompt, context);
  } catch (error) {
    console.error('Error generating response with history:', error);
    return await generateResponse(prompt); // Fallback to no context
  }
}

// Generate contextual quick replies
async function generateQuickReplies(userMessage, botResponse) {
  try {
    const prompt = `Based on this conversation:
User: ${userMessage}
Bot: ${botResponse}

Generate 2-3 relevant follow-up questions or actions the user might want to take. 
Return them as a JSON array of strings, each under 20 characters.
Example: ["Tell me more", "Show examples", "Help"]`;

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
    
    // Default quick replies
    return ["Tell me more", "Help", "Start over"];
  } catch (error) {
    console.error('Error generating quick replies:', error);
    return ["Tell me more", "Help", "Start over"];
  }
}

module.exports = {
  generateResponse,
  generateResponseWithHistory,
  generateQuickReplies
};