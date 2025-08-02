/**
 * Test fixtures and mock data for ESSEN Facebook Messenger Bot tests
 */

// Mock Facebook user data
const mockUsers = {
  testUser1: {
    id: '12345678901234567',
    name: 'John Tan',
    profile_pic: 'https://example.com/profile1.jpg'
  },
  testUser2: {
    id: '23456789012345678',
    name: 'Mary Lim',
    profile_pic: 'https://example.com/profile2.jpg'
  },
  testUser3: {
    id: '34567890123456789',
    name: 'Ahmad Rahman',
    profile_pic: 'https://example.com/profile3.jpg'
  }
};

// Mock Facebook messages
const mockMessages = {
  simpleText: {
    sender: { id: mockUsers.testUser1.id },
    message: { text: 'Hello' },
    timestamp: Date.now()
  },
  promotionInquiry: {
    sender: { id: mockUsers.testUser1.id },
    message: { text: 'Do you have any toilet sets on promotion?' },
    timestamp: Date.now()
  },
  faqInquiry: {
    sender: { id: mockUsers.testUser2.id },
    message: { text: 'What are your showroom operating hours?' },
    timestamp: Date.now()
  },
  appointmentRequest: {
    sender: { id: mockUsers.testUser3.id },
    message: { text: 'I want to book an appointment for tomorrow at 2pm' },
    timestamp: Date.now()
  },
  quickReply: {
    sender: { id: mockUsers.testUser1.id },
    message: {
      text: 'View products',
      quick_reply: { payload: 'View products' }
    },
    timestamp: Date.now()
  },
  imageAttachment: {
    sender: { id: mockUsers.testUser2.id },
    message: {
      attachments: [{
        type: 'image',
        payload: { url: 'https://example.com/room-photo.jpg' }
      }]
    },
    timestamp: Date.now()
  }
};

// Mock promotion templates
const mockPromotionTemplates = [
  {
    id: 1,
    title: 'Toilet Sets Promotion',
    category: 'toilet_sets',
    content: 'Great choice! Our toilet sets are very popular right now! 🚽\nWe have complete packages - toilet bowl + basin + accessories.\nWould you like to see our current promotion packages?',
    variables: JSON.stringify([
      { name: 'user_name', default_value: 'Customer' },
      { name: 'timestamp', default_value: '' }
    ]),
    quick_replies: JSON.stringify([
      { title: 'Toilet promotions', payload: 'TOILET_PROMO' },
      { title: 'Book showroom visit', payload: 'BOOK_VISIT' },
      { title: 'WhatsApp for prices', payload: 'WHATSAPP_PRICES' }
    ]),
    media_url: 'https://example.com/toilet-sets.jpg',
    media_type: 'image',
    follow_up_message: 'Still thinking about the toilet sets? Our design consultant can help you choose!',
    keywords: 'toilet,bathroom,wc,basin,promotion',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 2,
    title: 'Kitchen Solutions',
    category: 'kitchen_appliances',
    content: 'Hello {{user_name}}! Kitchen renovation is exciting! 🍳\nWe have complete kitchen solutions - sinks, taps, and everything you need.\nOur kitchen packages are very popular because everything matches perfectly.',
    variables: JSON.stringify([
      { name: 'user_name', default_value: 'Customer' }
    ]),
    quick_replies: JSON.stringify([
      { title: 'Kitchen packages', payload: 'KITCHEN_PACKAGES' },
      { title: 'Design consultation', payload: 'DESIGN_CONSULT' }
    ]),
    media_url: 'https://example.com/kitchen-sets.jpg',
    media_type: 'image',
    follow_up_message: 'Kitchen renovation is a big decision. Our consultants can help you plan the perfect layout!',
    keywords: 'kitchen,sink,tap,faucet,appliance',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Mock FAQ data
const mockFAQs = [
  {
    id: 1,
    question: 'What are your showroom operating hours?',
    answer: 'Our showroom is open 11am-7pm daily, including weekends and public holidays. We\'re located at 36 Jalan Kilang Barat, Singapore 598576.',
    category: 'general',
    keywords: 'hours,time,open,operating,showroom',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 2,
    question: 'Do you provide delivery service?',
    answer: 'Yes! We provide island-wide delivery. Delivery typically takes 1-2 weeks for in-stock items and 6-8 weeks for pre-orders. Delivery fees apply based on location.',
    category: 'delivery',
    keywords: 'delivery,shipping,transport,send',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 3,
    question: 'What warranty do you provide?',
    answer: 'We provide manufacturer warranty for all our products. Warranty periods vary by product type - typically 1-5 years. Ask our consultants for specific warranty details.',
    category: 'warranty',
    keywords: 'warranty,guarantee,coverage,protection',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Mock conversation history
const mockConversationHistory = [
  {
    user_id: mockUsers.testUser1.id,
    user_message: 'Hello',
    bot_response: 'Welcome to ESSEN Furniture! How can I help you today?',
    timestamp: new Date(Date.now() - 300000) // 5 minutes ago
  },
  {
    user_id: mockUsers.testUser1.id,
    user_message: 'Looking for sofas',
    bot_response: 'Great! We have amazing sofa collections. Our signature leather sofas are very popular.',
    timestamp: new Date(Date.now() - 240000) // 4 minutes ago
  },
  {
    user_id: mockUsers.testUser1.id,
    user_message: 'What about prices?',
    bot_response: 'Our sofa prices vary depending on size and materials. Best to visit our showroom to see the quality and get accurate pricing!',
    timestamp: new Date(Date.now() - 180000) // 3 minutes ago
  }
];

// Mock bot configuration
const mockBotConfig = {
  faq_matching_enabled: '1',
  template_matching_enabled: '1',
  quick_replies_enabled: '1',
  promotion_delay_ms: '8000',
  follow_up_delay_ms: '300000',
  human_intervention_threshold: '3',
  typing_speed_wpm: '60'
};

// Mock analytics events
const mockAnalyticsEvents = [
  {
    event_type: 'message_received',
    user_id: mockUsers.testUser1.id,
    event_data: { messageType: 'text' },
    timestamp: new Date()
  },
  {
    event_type: 'promotion_served',
    user_id: mockUsers.testUser1.id,
    event_data: { category: 'toilet_sets', template_id: 1 },
    timestamp: new Date()
  },
  {
    event_type: 'faq_served',
    user_id: mockUsers.testUser2.id,
    event_data: { faq_id: 1, confidence: 'high' },
    timestamp: new Date()
  }
];

// Mock user preferences
const mockUserPreferences = {
  [mockUsers.testUser1.id]: {
    language: 'en',
    preferred_categories: ['sofas', 'dining'],
    notification_preferences: { promotions: true, appointments: true }
  },
  [mockUsers.testUser2.id]: {
    language: 'en',
    preferred_categories: ['kitchen', 'bathroom'],
    notification_preferences: { promotions: false, appointments: true }
  }
};

// Singapore-specific test messages
const singaporeMessages = {
  singlish: [
    'Wah your sofa very nice leh, got promotion or not?',
    'Eh bro, kitchen renovation can help anot?',
    'Aiyo need toilet bowl for BTO, got cheap one?',
    'Uncle, your showroom where ah? Can go see see?'
  ],
  housing: [
    'I staying in HDB flat, need compact dining table',
    'My condo quite small, got space-saving furniture?',
    'BTO renovation package got anot?',
    'Executive flat kitchen how to design?'
  ],
  urgency: [
    'Need urgent delivery for house moving next week',
    'Wedding coming up, need dining set ASAP',
    'Renovation deadline very tight, can rush order?'
  ]
};

// Test data for different conversation scenarios
const conversationScenarios = {
  promotionInquiry: {
    user_message: 'Do you have toilet sets promotion?',
    expected_category: 'toilet_sets',
    expected_confidence: 'high'
  },
  faqInquiry: {
    user_message: 'What time you open?',
    expected_faq_id: 1,
    expected_confidence: 'medium'
  },
  appointmentBooking: {
    user_message: 'Book appointment tomorrow 3pm',
    expected_appointment: {
      date: 'tomorrow',
      time: '3pm',
      valid: true
    }
  },
  humanIntervention: {
    user_message: 'I am very frustrated with your service, this is unacceptable!',
    expected_intervention: {
      required: true,
      urgency: 'high',
      reason: 'customer_frustration'
    }
  }
};

// Performance test data
const performanceTestData = {
  concurrentUsers: 50,
  messagesPerUser: 10,
  testDuration: 60000, // 1 minute
  expectedResponseTime: 2000, // 2 seconds
  maxConcurrentConnections: 100
};

module.exports = {
  mockUsers,
  mockMessages,
  mockPromotionTemplates,
  mockFAQs,
  mockConversationHistory,
  mockBotConfig,
  mockAnalyticsEvents,
  mockUserPreferences,
  singaporeMessages,
  conversationScenarios,
  performanceTestData
};