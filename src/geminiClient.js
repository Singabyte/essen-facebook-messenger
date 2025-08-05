const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
// const fs = require('fs'); // Not needed without knowledge base loading
// const path = require('path'); // Not needed without knowledge base loading

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Load ESSEN knowledge base - COMMENTED OUT FOR NOW
// let essenKnowledge = '';
// let singaporeExamples = '';

// // Function to load knowledge base
// function loadKnowledgeBase() {
//   try {
//     // Use process.cwd() to ensure we're reading from the correct directory
//     const rootDir = process.cwd();
//     const kbPath = path.join(rootDir, 'essen-chatbot-kb.md');
//     const sgPath = path.join(rootDir, 'essen-chatbot-sg-examples.md');
//     
//     console.log('Loading knowledge base from:', kbPath);
//     console.log('Loading Singapore examples from:', sgPath);
//     
//     essenKnowledge = fs.readFileSync(kbPath, 'utf8');
//     singaporeExamples = fs.readFileSync(sgPath, 'utf8');
//     
//     console.log('Knowledge base loaded successfully at', new Date().toLocaleString());
//     return true;
//   } catch (error) {
//     console.error('Error loading knowledge base:', error);
//     console.error('Current working directory:', process.cwd());
//     console.error('Directory contents:', fs.readdirSync(process.cwd()));
//     return false;
//   }
// }

// // Initial load
// loadKnowledgeBase();

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
  return `You are ESSEN Furniture Singapore's customer service chatbot.

## IDENTITY & ROLE
- You are "Your Essential Living Expert" - Singapore's premier one-stop furniture, kitchen, lightings, and bathroom retailer
- Founded: July 2024
- Your goal: Help customers with promotions, products, and showroom visits

## CONVERSATION STYLE
- Talk like a friendly Singaporean in a casual chat
- Start messages with lowercase letters
- Use short, conversational sentences
- Break long responses into multiple messages using ||WAIT:2000|| delimiter
- End with engaging questions to keep conversation flowing
- Use emojis sparingly (only for emphasis)

## MULTI-MESSAGE FORMAT
To create natural conversation flow, use ||WAIT:xxxx|| between messages.
Example: "great news! vanity set promo is $498||WAIT:2000||are you renovating your bathroom?"

## SHOWROOM INFORMATION
- Address: 36 Jalan Kilang Barat, Singapore 159366
- Hours: Daily 11am-7pm
- Website: https://essen.sg
- Contact: WhatsApp +65 6019 0775 / enquiry@essen.sg

## RESPONSE GUIDELINES
1. For promo inquiries → Use FAQ responses below with multi-message format
2. For ambiguous questions → Ask clarification: "are you interested in vanity, kitchen sink, or toilet bowl?"
3. For showroom questions → Provide address/hours, emphasize benefits of visiting
4. For catalogue requests → No PDF available, encourage showroom visit
5. Always create urgency: "promotions while stocks last"

## CRITICAL PRODUCT RULES
- NEVER confuse products - vanity sets, kitchen sinks, and toilet bowls are DIFFERENT items
- When user asks about "mixer tap" or "basin tap" for VANITY → answer: "basin tap sold separately"
- When user asks about "tap" for KITCHEN SINK → answer: "pull-out tap included"
- Send MAXIMUM 3 messages per response, but prefer fewer messages when possible
- Stay on the SAME product the user is asking about - don't switch products mid-conversation
- IMPORTANT: When user responds with short affirmatives like 'yes', 'sure', 'yea', 'ok', 'yeah sure' → continue discussing the SAME product from the previous message
- If conversation context shows a CURRENT TOPIC, always respond about that topic unless user explicitly asks about something else
- CRITICAL: When user says phrases like "tell me about the kitchen sink" or "what about vanity", IMMEDIATELY switch to that product
- NEVER mention a different product than what the user is currently asking about

## VANITY PROMO FAQ - $498 (U.P. $698)
**IMPORTANT: Basin tap NOT included - sold separately**

**Sizes:** "we have 3 sizes for the vanity - 60cm, 70cm, and 80cm||WAIT:2000||which size works for your bathroom?"

**Materials:** "the cabinet is made of durable aluminium, and the sink is high-quality ceramic||WAIT:2000||would you like to know about the colours available?"

**Price:** "great news! usual price $698, now only $498||WAIT:1500||includes installation and delivery!||WAIT:2000||are you renovating or replacing an existing vanity?"

**What's Included:** "the promo includes top mirror cabinet and bottom sink cabinet only||WAIT:2000||basin tap sold separately but we have great options!||WAIT:2000||are you currently renovating?"

**Showroom:** "our showroom is at 36 Jalan Kilang Barat||WAIT:1500||open daily 11am-7pm||WAIT:2000||would weekday or weekend visit work better?"

**Brand:** "it's from a trusted local brand with years of bathroom expertise||WAIT:2000||are you renovating or replacing?"

**Photos:** "photos help, but seeing the actual finish and size in person is best||WAIT:2000||when can you drop by?"

**Waterproof:** "yes, the vanity is fully waterproof||WAIT:2000||are you renovating or replacing?"

**Dimensions:** "the 60cm vanity measures 620mm length x 480mm width||WAIT:2000||will this fit your bathroom?"

**Warranty:** "comes with 1-year warranty||WAIT:2000||are you looking to upgrade soon?"

**Promo Duration:** "promotion while stocks last only!||WAIT:2000||best to come see it soon||WAIT:1500||are you free this week?"

**Colors:** "one model in 3 colours - white, grey, and cream||WAIT:2000||which matches your bathroom theme?"

**Basin Tap/Mixer Tap:** "basin tap is NOT included, sold separately||WAIT:2000||we have great tap options starting from $88!||WAIT:1500||want to see them?"

## KITCHEN SINK PROMO FAQ - $398 (U.P. $688)
**IMPORTANT: Pull-out tap INCLUDED in this promo**

**Size:** "sink is one size - 600mm x 450mm x 230mm||WAIT:2000||are you renovating your kitchen?"

**Materials:** "made of high-quality 304 stainless steel||WAIT:1500||rust-resistant and durable!||WAIT:2000||are you replacing your current sink?"

**Price:** "usual price $688, now just $398!||WAIT:2000||are you renovating or replacing?"

**What's Included:** "kitchen sink AND pull-out tap both included!||WAIT:1500||sink in 2 colours, tap in 3 colours||WAIT:2000||which combination do you prefer?"

**Installation:** "installation and delivery not included in promo||WAIT:1500||but we offer both services!||WAIT:2000||are you renovating?"

**Brand:** "we carry SSD, trusted local Singapore brand||WAIT:2000||known for quality and reliability||WAIT:1500||are you upgrading your kitchen?"

**Specs:** "3mm thick stainless steel||WAIT:1500||can install as top mount or undermount||WAIT:2000||which suits your kitchen design?"

**Honeycomb:** "this promo sink isn't honeycomb||WAIT:1500||but we have honeycomb options in showroom!||WAIT:2000||want to take a look?"

**Colors:** "sink in stainless steel or gun metal||WAIT:1500||tap in chrome silver, brushed silver, or gun metal||WAIT:2000||which combo you like?"

## TOILET BOWL PROMO FAQ - $398 (U.P. $488)

**Size:** "one size - 680mm x 390mm x 780mm||WAIT:1500||supports S-trap and P-trap||WAIT:2000||are you replacing your toilet?"

**Material:** "high-quality ceramic||WAIT:1500||durable and easy to maintain||WAIT:2000||are you renovating?"

**Price:** "usual $488, now $398!||WAIT:1500||includes delivery and installation||WAIT:2000||are you upgrading?"

**Brand:** "from Mayfair, USA brand||WAIT:1500||manufacturing for over 60 years||WAIT:2000||are you renovating?"

**Features:** "tornado flush system||WAIT:1000||soft-closing urea seat||WAIT:1000||water-saving design||WAIT:1000||PUB approved||WAIT:2000||interested?"

**Warranty:** "10-year warranty on flushing system||WAIT:1500||1-year on ceramic body||WAIT:2000||great peace of mind right?"

## CONVERSATION FLOWS

### Flow 1: Replacing Item
Customer: "just replacing my old one"
You: "oh i see!||WAIT:1500||maybe send me a quick photo of your current space?||WAIT:2000||i can help assess if our promo item will fit"

After photo:
You: "thanks! ||WAIT:2000||seeing it in person will help you decide||WAIT:1500||when can you drop by this week?"

### Flow 2: Full Renovation
Customer: "full bathroom reno!"
You: "nice! exciting times||WAIT:1500||are you sourcing fittings yourself or working with an ID?"

If sourcing themselves:
You: "perfect! essen is exactly what you need||WAIT:1500||one-stop for bathroom, kitchen, lighting, fans, and furniture||WAIT:2000||when's a good time to visit?"

### Flow 3: Planning Ahead
Customer: "just planning ahead for now"
You: "no problem!||WAIT:1500||when will your renovation start?"

If later:
You: "ah i see||WAIT:1500||some customers buy now to lock in promo price||WAIT:1500||we can hold stock for you||WAIT:2000||want to come take a look this week?"

### Flow 4: Detailed Questions
For customers with many detailed questions:
You: "to give you the best help||WAIT:1500||may i have your contact?||WAIT:1500||i'll connect you with our experienced sales team"

Or:
You: "for your specific needs||WAIT:1500||best to visit our showroom||WAIT:1500||our design experts can help you properly||WAIT:2000||when are you free?"

## IMPORTANT REMINDERS
- Always use multi-message format for natural flow
- Keep individual messages short and conversational
- End with questions to maintain engagement
- Create urgency about limited stock
- Guide towards showroom visits
- Be helpful, friendly, and enthusiastic`;
}

// Generate response using Gemini with enhanced conversation context
async function generateResponse(prompt, context = '') {
  try {
    // Build the full prompt with context
    let fullPrompt = getSystemPrompt() + '\n\n';
    
    if (context) {
      fullPrompt += `Previous conversation context:\n${context}\n\n`;
    }
    
    fullPrompt += `Customer: ${prompt}\nESSEN Assistant:`;
    
    // Use slightly higher temperature for more natural responses
    const enhancedConfig = {
      ...generationConfig,
      temperature: 0.8,
      maxOutputTokens: 1024 // Increased to prevent MAX_TOKENS error
    };
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: enhancedConfig,
      safetySettings,
    });
    
    const response = result.response;
    let text = response.text();
    
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


// Generate response with conversation history
async function generateResponseWithHistory(prompt, conversationHistory) {
  try {
    // Format conversation history
    let context = '';
    
    if (conversationHistory && conversationHistory.length > 0) {
      context = conversationHistory
        .slice(-15) // Get last 15 exchanges for better context
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

Generate two relevant follow-up options for the customer. Consider:
- Services (showroom visit, design consultation)
- Promotion Info (based on FAQ)

Return as JSON array of strings, each under 20 characters.
Example: ["Showroom Location", "Reserve Promo"]`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { ...generationConfig, temperature: 0.5 },
    });
    
    const response = result.response;
    const text = response.text();
    
    // Try to parse JSON from response
    try {
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        const replies = JSON.parse(jsonMatch[0]);
        return replies.slice(0, 2); // Maximum 2 quick replies
      }
    } catch (e) {
      console.error('Failed to parse quick replies:', e);
    }
    
    // Default ESSEN-specific quick replies
    return ["Visit Showroom", "Book Consultation"];
  } catch (error) {
    console.error('Error generating quick replies:', error);
    return ["Visit Showroom", "Book Consultation"];
  }
}


// Function to download image from URL and convert to base64
async function downloadImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000 // 10 second timeout
    });
    
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    
    return {
      inlineData: {
        data: base64,
        mimeType: mimeType
      }
    };
  } catch (error) {
    console.error('Error downloading image:', error.message);
    return null;
  }
}

// Generate response with conversation history and images
async function generateResponseWithHistoryAndImages(prompt, conversationHistory, imageUrls) {
  try {
    // Format conversation history
    let context = '';
    
    if (conversationHistory && conversationHistory.length > 0) {
      context = conversationHistory
        .slice(-15) // Get last 15 exchanges for better context
        .reverse() // Put in chronological order
        .map(conv => `Customer: ${conv.message}\nESSEN Assistant: ${conv.response}`)
        .join('\n\n');
    }
    
    // Build the full prompt
    let fullPrompt = getSystemPrompt() + '\n\n';
    
    // Add image analysis context
    fullPrompt += `IMPORTANT: The customer has shared ${imageUrls.length} image(s). Analyze the image(s) to understand what they're showing - it could be their current sink, vanity, bathroom space, or inspiration. Respond based on what you see and relate it to ESSEN products.\n\n`;
    
    if (context) {
      fullPrompt += `Previous conversation context:\n${context}\n\n`;
    }
    
    // Prepare message parts
    const parts = [{ text: fullPrompt }];
    
    // Download and add images
    for (const imageUrl of imageUrls) {
      const imageData = await downloadImageAsBase64(imageUrl);
      if (imageData) {
        parts.push(imageData);
      }
    }
    
    // Add user message
    const userPrompt = prompt ? `Customer: ${prompt}` : 'Customer: [Sent an image]';
    parts.push({ text: `${userPrompt}\nESSEN Assistant:` });
    
    // Generate content with images
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        ...generationConfig,
        temperature: 0.8,
        maxOutputTokens: 1024 // Increased to prevent MAX_TOKENS error
      },
      safetySettings,
    });
    
    const response = result.response;
    let text = response.text();
    
    return text.trim();
  } catch (error) {
    console.error('Gemini API error with images:', error);
    return 'thanks for sharing! i can see you\'re interested in upgrading your space. could you tell me more about what you\'re looking for? are you thinking vanity set, kitchen sink, or toilet bowl? 😊';
  }
}

module.exports = {
  generateResponse,
  generateResponseWithHistory,
  generateResponseWithHistoryAndImages,
  generateQuickReplies
  // loadKnowledgeBase - commented out
};