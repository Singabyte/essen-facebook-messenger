// Test script to verify Socket.io connection between bot and admin backend
const io = require('socket.io-client');

console.log('🧪 Testing Socket.io connection to admin backend...\n');

// Connect to admin backend
const adminUrl = 'http://localhost:4000';
console.log(`📡 Connecting to: ${adminUrl}`);

const socket = io(adminUrl, {
  auth: {
    service: 'bot',
    secret: 'bot-service'
  },
  reconnection: false, // Don't reconnect for this test
  transports: ['websocket', 'polling']
});

// Set up event handlers
socket.on('connect', () => {
  console.log('✅ Connected successfully!');
  console.log('   Socket ID:', socket.id);
  console.log('   Transport:', socket.io.engine.transport.name);
  
  // Test sending metrics
  console.log('\n📊 Sending test metrics...');
  socket.emit('metrics:update', {
    messages: {
      total: 100,
      last_hour: 10,
      last_24h: 50,
      avg_response_time: 250
    },
    users: {
      total: 25,
      active_today: 5,
      active_this_week: 15
    },
    system: {
      memory_mb: 128
    },
    timestamp: new Date().toISOString()
  });
  
  // Test sending a message processed event
  console.log('💬 Sending test message...');
  socket.emit('message:processed', {
    user_id: 'test-user-123',
    user_name: 'Test User',
    message_text: 'Hello, I need help with furniture',
    response_text: 'I\'d be happy to help you with furniture!',
    response_time: 150,
    timestamp: new Date().toISOString()
  });
  
  console.log('\n✨ Test events sent successfully!');
  
  // Disconnect after 2 seconds
  setTimeout(() => {
    console.log('\n👋 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  console.error('   Error type:', error.type);
  console.error('   Make sure the admin backend is running on port 4000');
  process.exit(1);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error.message);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('\n⏱️ Connection timeout - admin backend may not be running');
  process.exit(1);
}, 5000);