# ESSEN Furniture Singapore Chatbot

This is a customized Facebook Messenger chatbot specifically designed for ESSEN Furniture Singapore, powered by Google's Gemini AI.

## Features

### 🤖 AI-Powered Conversations
- Natural language understanding with Singapore context
- Gemini AI integration with ESSEN knowledge base
- Contextual responses based on conversation history
- Singapore English (Singlish-aware) communication style

### 📚 ESSEN Knowledge Integration
- Complete product catalog (furniture, kitchen, bathroom)
- Showroom information and services
- Company philosophy and values
- Best sellers and recommendations

### 💬 Smart Commands
- `/help` - Get help and see available commands
- `/products` - View all product categories
- `/showroom` - Showroom location and services
- `/consultation` - Free design consultation info
- `/bestsellers` - Popular products
- `/about` - About ESSEN Furniture
- `/clear` - Clear conversation history

### 🎯 Quick Replies
- Dynamic quick reply suggestions
- Context-aware follow-up options
- Easy navigation through product categories

### 🇸🇬 Singapore Context
- Understanding of HDB, BTO, condo contexts
- Local expressions and communication style
- Climate-aware recommendations
- Festival considerations (CNY, Hari Raya, etc.)

## How It Works

1. **Knowledge Base**: The bot loads ESSEN's product catalog and Singapore language examples on startup
2. **Contextual Understanding**: Uses conversation history to provide relevant responses
3. **Smart Routing**: Recognizes product inquiries and routes to appropriate information
4. **Showroom Focus**: Encourages visits for the complete ESSEN experience

## Testing the Bot

### Local Testing
```bash
# Test ESSEN-specific responses
node scripts/test-essen-bot.js

# Run the bot locally
npm run dev

# Test with sample queries
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"page","entry":[{"messaging":[{"sender":{"id":"123"},"message":{"text":"Looking for sofa for my BTO"}}]}]}'
```

### Sample Conversations

**Customer**: "Hi, I'm looking for a sofa for my new BTO"
**Bot**: Recognizes BTO context, suggests modular sofas, mentions free consultation

**Customer**: "Do you have leather sofa that won't be too hot?"
**Bot**: Addresses Singapore climate concerns, explains breathable leather options

**Customer**: "What's the price range?"
**Bot**: Avoids specific pricing, encourages showroom visit for quotes

## Configuration

### Environment Variables
```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key

# Facebook Configuration
PAGE_ACCESS_TOKEN=your_page_token
VERIFY_TOKEN=your_verify_token
APP_SECRET=your_app_secret
```

### Knowledge Base Files
- `essen-chatbot-kb.md` - Complete ESSEN product and service information
- `essen-chatbot-sg-examples.md` - Singapore context language examples

## Deployment

1. Ensure knowledge base files are in the root directory
2. Configure environment variables
3. Deploy to production server
4. Set up Facebook webhook

## Customization

### Adding New Products
Update `essen-chatbot-kb.md` with new product information

### Modifying Responses
Edit system prompt in `src/geminiClient.js` for tone adjustments

### Adding Commands
Add new commands in `src/messageHandler.js` `handleTextMessage()` function

## Best Practices

1. **Regular Updates**: Keep knowledge base current with latest products
2. **Monitor Conversations**: Review analytics for improvement opportunities
3. **Test Locally**: Always test changes before deployment
4. **Backup Knowledge**: Keep versioned copies of knowledge base files

## Support

For technical issues or updates to the ESSEN knowledge base, please contact the development team.