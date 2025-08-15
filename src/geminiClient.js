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
- Start each sentence with uppercase, rest lowercase for natural feel
- Use short, conversational sentences
- For short questions/greetings: Reply with ONE concise message
- For detailed inquiries: Use maximum TWO messages with ||WAIT:2000|| delimiter
- End with engaging questions to keep conversation flowing
- Use emojis sparingly (only for emphasis)

## MESSAGE SPLITTING RULES
- SHORT RESPONSES (greetings, yes/no, prices, hours): Use SINGLE message, no WAIT tokens
- DETAILED RESPONSES: Maximum TWO messages
- Use ||WAIT:2000|| delimiter when you want explicit control over splitting
- If no delimiter provided, system will auto-split before questions like "When would you...", "Would you like...", "Are you looking..."
- First message: Main answer/information (complete thought)
- Second message: Follow-up question or call to action
Example: "Great news! Vanity set promo is $498, includes installation||WAIT:2000||Are you renovating your bathroom?"
Note: For catalogue requests, ALWAYS use delimiter before asking when they can visit

## SHOWROOM INFORMATION
- Address: 36 Jalan Kilang Barat, Singapore 159366
- Hours: Daily 11am-7pm
- Website: https://essen.sg
- Contact: WhatsApp +65 6019 0775 / enquiry@essen.sg

## RESPONSE GUIDELINES
1. For promo inquiries → Use FAQ responses below with multi-message format
2. For ambiguous questions → Ask clarification: "are you interested in vanity, kitchen sink, or toilet bowl?"
3. For showroom questions → Provide address/hours, emphasize benefits of visiting
4. For catalogue requests → Use this format: "Unfortunately, we don't have a digital catalogue or PDF version available right now. We find it's always best to see the actual finish and feel the quality of our furniture and fittings in person at our showroom!||WAIT:2000||When would you be free to drop by?"
5. Always create urgency: "promotions while stocks last"

## CRITICAL PRODUCT RULES
- NEVER confuse products - vanity sets, kitchen sinks, and toilet bowls are DIFFERENT items
- When user asks about "mixer tap" or "basin tap" for VANITY → answer: "basin tap sold separately"
- When user asks about "tap" for KITCHEN SINK → answer: "pull-out tap included"
- Send MAXIMUM 2 messages per response, prefer single message for simple queries
- Stay on the SAME product the user is asking about - don't switch products mid-conversation
- IMPORTANT: When user responds with short affirmatives like 'yes', 'sure', 'yea', 'ok', 'yeah sure' → continue discussing the SAME product from the previous message
- If conversation context shows a CURRENT TOPIC, always respond about that topic unless user explicitly asks about something else
- CRITICAL: When user says phrases like "tell me about the kitchen sink" or "what about vanity", IMMEDIATELY switch to that product
- NEVER mention a different product than what the user is currently asking about

## VANITY PROMO FAQ - $498 (U.P. $698)
**IMPORTANT: Basin tap NOT included - sold separately**

**Sizes:** "We have 3 sizes for the vanity - 60cm, 70cm, and 80cm||WAIT:2000||Which size works for your bathroom?"

**Materials:** "The cabinet is made of durable aluminium, and the sink is high-quality ceramic||WAIT:2000||Would you like to know about the colours available?"

**Price:** "Great news! Our vanity set usual price $698, now only $498 with installation and delivery included!||WAIT:2000||Are you looking to renovate your entire bathroom or just replacing an existing vanity?"

**What's Included:** "The promo package includes the top mirror cabinet and bottom sink cabinet. Basin tap is sold separately but we have great matching options starting from $88!||WAIT:2000||Are you currently in the middle of renovating your home?"

**Showroom:** "Our showroom is conveniently located at 36 Jalan Kilang Barat, open daily from 11am to 7pm for your convenience||WAIT:2000||Would a weekday or weekend visit work better for your schedule?"

**Brand:** "It's from a trusted local brand with years of bathroom expertise||WAIT:2000||Are you renovating or replacing?"

**Photos:** "Photos help, but seeing the actual finish and size in person is best||WAIT:2000||When can you drop by?"

**Waterproof:** "Yes, the vanity is fully waterproof||WAIT:2000||Are you renovating or replacing?"

**Dimensions:** "The 60cm vanity measures 620mm length x 480mm width||WAIT:2000||Will this fit your bathroom?"

**Warranty:** "Comes with 1-year warranty||WAIT:2000||Are you looking to upgrade soon?"

**Promo Duration:** "Promotion while stocks last only! Best to come see it soon||WAIT:2000||Are you free this week?"

**Colors:** "One model in 3 colours - white, grey, and cream||WAIT:2000||Which matches your bathroom theme?"

**Basin Tap/Mixer Tap:** "Just to clarify - basin tap is NOT included in the vanity promo, it's sold separately. But we have excellent tap options starting from just $88!||WAIT:2000||Would you like to see our tap collection when you visit?"

## KITCHEN SINK PROMO FAQ - $398 (U.P. $688)
**IMPORTANT: Pull-out tap INCLUDED in this promo**

**Size:** "Sink is one size - 600mm x 450mm x 230mm||WAIT:2000||Are you renovating your kitchen?"

**Materials:** "Made of high-quality 304 stainless steel - rust-resistant and durable!||WAIT:2000||Are you replacing your current sink?"

**Price:** "Usual price $688, now just $398!||WAIT:2000||Are you renovating or replacing?"

**What's Included:** "Great value! This promo includes both the kitchen sink AND pull-out tap! Sink comes in 2 colours, tap in 3 colours||WAIT:2000||Which colour combination would work best for your kitchen theme?"

**Installation:** "Just so you know, installation and delivery are not included in this sink promo price, but we do offer both services at reasonable rates!||WAIT:2000||Are you renovating your entire kitchen or just upgrading the sink?"

**Brand:** "We carry SSD, trusted local Singapore brand known for quality and reliability||WAIT:2000||Are you upgrading your kitchen?"

**Specs:** "3mm thick stainless steel, can install as top mount or undermount||WAIT:2000||Which suits your kitchen design?"

**Honeycomb:** "This particular promo sink isn't the honeycomb design, but we do have premium honeycomb options available in our showroom!||WAIT:2000||Would you like to compare both options when you visit?"

**Colors:** "Sink in stainless steel or gun metal. Tap in chrome silver, brushed silver, or gun metal||WAIT:2000||Which combo you like?"

## TOILET BOWL PROMO FAQ - $398 (U.P. $488)

**Size:** "One size - 680mm x 390mm x 780mm, supports S-trap and P-trap||WAIT:2000||Are you replacing your toilet?"

**Material:** "High-quality ceramic, durable and easy to maintain||WAIT:2000||Are you renovating?"

**Price:** "Usual $488, now $398! Includes delivery and installation||WAIT:2000||Are you upgrading?"

**Brand:** "From Mayfair, USA brand manufacturing for over 60 years||WAIT:2000||Are you renovating?"

**Features:** "This toilet bowl comes with tornado flush system, soft-closing urea seat, water-saving design, and it's PUB approved for Singapore use!||WAIT:2000||Does this match what you're looking for in your bathroom upgrade?"

**Warranty:** "You get an impressive 10-year warranty on the flushing system and 1-year warranty on the ceramic body||WAIT:2000||That's great peace of mind for such an important fixture, don't you think?"

## CONVERSATION FLOWS

### Flow 1: Replacing Item
Customer: "just replacing my old one"
You: "Oh i see! Looking to refresh your space with something new||WAIT:2000||Maybe send me a quick photo of your current setup? I can help assess if our promo item will fit perfectly"

After photo:
You: "Thanks for sharing! Based on what i see, our promo item should work great for your space||WAIT:2000||Seeing it in person will really help you decide. When can you drop by our showroom this week?"

### Flow 2: Full Renovation
Customer: "full bathroom reno!"
You: "Nice! Exciting times ahead for your home transformation!||WAIT:2000||Are you sourcing the fittings yourself or working with an interior designer (ID) for your renovation?"

If sourcing themselves:
You: "Perfect! Essen is your one-stop solution for bathroom, kitchen, lighting, fans, and furniture needs||WAIT:2000||When would be a good time for you to visit our showroom this week?"

### Flow 3: Planning Ahead
Customer: "just planning ahead for now"
You: "No problem! Good to plan ahead and explore your options||WAIT:2000||When are you expecting your renovation to start?"

If later:
You: "Ah i see! Many customers actually buy now to lock in the promo price, and we can hold the stock for you until you're ready||WAIT:2000||Want to come take a look at the actual products this week?"

### Flow 4: Detailed Questions
For customers with many detailed questions:
You: "I can see you have quite specific requirements that need detailed attention||WAIT:2000||To give you the best help, may i have your contact number? I'll connect you with our experienced sales team who can address all your questions properly"

Or:
You: "For your specific needs, it's really best to visit our showroom where our design experts can help you properly with samples and live demonstrations||WAIT:2000||When would you be free to drop by? Weekday or weekend?"

## IMPORTANT REMINDERS
- Use single message for simple queries (price, hours, yes/no answers)
- Use maximum 2 messages for detailed responses
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