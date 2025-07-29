# Facebook Automation Setup Guide

## How Your Bot Works with Facebook Automations

### Integration Overview

```
Customer → Facebook Instant Reply → Your Bot → Human Agent (if needed)
```

## 1. Setting Up Instant Reply

**Purpose**: First response when someone messages your page

### Steps:
1. Go to **Facebook Page Settings** → **Messaging**
2. Click **Instant Reply** → Turn ON
3. Set this message:

```
Hi! Thanks for reaching out to ESSEN Furniture Singapore! 🏠 

I'm the ESSEN Assistant, ready to help you with:
• 🛋️ Furniture selections
• 🍳 Kitchen solutions  
• 🚿 Bathroom fixtures
• 📅 Showroom appointments

Quick commands:
Type /help for assistance
Type /products to browse
Type /showroom for location

What can I help you with today?
```

## 2. Away Messages

**Purpose**: When you're marked as away

### Setup:
1. Go to **Settings** → **Messaging** → **Away Message**
2. Set schedule (e.g., outside business hours)
3. Message:

```
We're currently away but our AI assistant is here to help! 

For immediate assistance with products or bookings, just type your question.

For urgent matters, type /human to request a callback during business hours.

Our showroom hours:
Mon-Sat: 10 AM - 7 PM
Sun: 11 AM - 6 PM
```

## 3. Frequently Asked Questions

### Add these FAQs that trigger bot responses:

| Question | Answer |
|----------|---------|
| "What are your prices?" | "For detailed pricing, visit our showroom or type /consultation for a free design session where we can provide accurate quotes!" |
| "Do you deliver?" | "Yes! Delivery typically takes 1-2 weeks for in-stock items. Type /showroom to visit us and discuss delivery options." |
| "What products do you have?" | "Type /products to see our full range of furniture, kitchen, and bathroom solutions!" |
| "Where are you located?" | "Type /showroom for our location and hours. We're in Singapore!" |
| "Do you have promotions?" | "Type /bestsellers to see popular items. Visit our showroom for current promotions!" |

## 4. Saved Replies (For Human Agents)

Create these templates for your team:

### Greeting Template:
```
Hi [Name]! Thanks for your interest in ESSEN Furniture. I'm [Agent Name], and I'll personally assist you today. How can I help transform your home?
```

### Product Inquiry:
```
Great choice! Our [product] collection features [key benefits]. Would you like to:
- Schedule a showroom visit to see it in person?
- Receive more detailed specifications?
- Book a free design consultation?
```

### Appointment Booking:
```
I'd be happy to schedule your visit! We have availability on:
- [Date/Time Option 1]
- [Date/Time Option 2]
- [Date/Time Option 3]

Our address: [Showroom Address]
Free parking available!
```

## 5. Messenger Greeting

**What customers see before starting a conversation:**

### Setup:
1. Already configured in your bot code
2. Shows: "Welcome to ESSEN Furniture Singapore! 🏠 Your Essential Living Expert. Click Get Started to begin!"

## 6. Persistent Menu

**Always visible menu in Messenger:**

Already configured with:
- 🛍️ Browse Products
- 📍 Visit Showroom  
- 🎨 Free Consultation
- ⭐ Best Sellers
- ❓ Help (submenu)

## 7. Quick Replies Integration

Your bot automatically generates contextual quick replies like:
- "View sofas"
- "Book consultation"
- "Showroom info"

## 8. Handover Protocol

### When to Transfer to Human:
- Customer types `/human` or `/agent`
- Complex customization requests
- Pricing negotiations
- Complaints

### How it Works:
1. Bot detects transfer trigger
2. Passes control to Page Inbox
3. Human agent receives notification
4. Agent handles conversation
5. Agent can pass back to bot when done

## 9. Response Priorities

1. **Facebook Instant Reply** (0-2 seconds)
   - Generic welcome message
   
2. **Your Bot** (2-5 seconds)
   - Contextual, intelligent responses
   
3. **Human Agent** (when requested)
   - Personal touch for complex queries

## 10. Message Tags & Types

Your bot handles:
- **Regular messages**: General inquiries
- **Quick replies**: Pre-set options
- **Postbacks**: Menu selections
- **Referrals**: From ads or m.me links

## 11. Creating m.me Links

Create targeted entry points:

```
https://m.me/YOUR_PAGE_ID?ref=sofa-promo
https://m.me/YOUR_PAGE_ID?ref=kitchen
https://m.me/YOUR_PAGE_ID?ref=consultation
```

Bot recognizes these and provides targeted welcomes!

## 12. Best Practices

### DO:
✅ Keep Instant Reply generic (bot provides specifics)
✅ Use FAQs to guide to bot commands
✅ Set clear expectations about bot vs human
✅ Provide easy human handoff option
✅ Use quick replies for common paths

### DON'T:
❌ Duplicate bot functionality in Instant Reply
❌ Make promises the bot can't keep
❌ Hide the human option
❌ Use conflicting information

## 13. Testing Your Setup

1. **Test as New User:**
   - Use a friend's account
   - Clear conversation history
   - Try each entry point

2. **Test Scenarios:**
   - First-time visitor
   - Returning customer
   - After business hours
   - Human handoff request

3. **Test Entry Points:**
   - Direct message
   - m.me link with ref
   - Facebook ad click
   - Website chat plugin

## 14. Analytics to Track

Monitor in Facebook Insights:
- Response time
- Response rate  
- Click-through on quick replies
- Human handoff frequency
- Most used commands

## 15. Optimization Tips

1. **Review Weekly:**
   - Check most asked questions
   - Update FAQs accordingly
   - Refine bot responses

2. **A/B Test:**
   - Different instant reply messages
   - Quick reply options
   - Greeting variations

3. **Seasonal Updates:**
   - CNY promotions
   - Special events
   - New product launches

Your bot now works seamlessly with Facebook's automation features! 🎉