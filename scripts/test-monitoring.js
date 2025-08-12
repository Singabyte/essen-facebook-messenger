// Test monitoring system with simulated bot data
const { metricsCollector } = require('../src/monitoring');
const adminSocketClient = require('../src/admin-socket-client');

console.log('🤖 Starting monitoring test with simulated bot data...\n');

// Connect to admin backend
adminSocketClient.connect();

// Simulate some initial data
console.log('📊 Generating initial metrics...');
for (let i = 0; i < 50; i++) {
  const userId = `user_${Math.floor(Math.random() * 10)}`;
  const responseTime = 100 + Math.random() * 500;
  metricsCollector.recordMessage(userId, Date.now(), responseTime);
}

console.log('✅ Initial metrics generated');
console.log('📈 Current stats:', metricsCollector.getStats());

// Simulate periodic metrics updates
console.log('\n🔄 Starting periodic updates (every 5 seconds)...');
let messageCount = 0;

const sendMetrics = () => {
  const metrics = metricsCollector.getStats();
  console.log(`\n📊 Sending metrics update #${++messageCount}`);
  console.log('   Total messages:', metrics.messages.total);
  console.log('   Active users:', metrics.users.active_today);
  adminSocketClient.sendMetrics(metrics);
};

// Send initial metrics
setTimeout(sendMetrics, 1000);

// Simulate incoming messages
const simulateMessage = () => {
  const users = ['Alice Chen', 'Benjamin Tan', 'Carol Lee', 'David Lim', 'Emma Wong'];
  const messages = [
    'I need help choosing a sofa for my HDB',
    'What are your bestsellers?',
    'Do you have any promotions?',
    'Can I schedule a consultation?',
    'Where is your showroom located?'
  ];
  const responses = [
    'I\'d be happy to help you find the perfect sofa for your HDB! Our ESSENZA collection offers great space-saving options.',
    'Our bestsellers include the CLOUD sofa and NORDIC dining sets. Would you like to know more?',
    'We currently have 10% off on selected items. Visit our showroom for more details!',
    'Absolutely! You can book a free consultation at our Ubi showroom. When would be convenient?',
    'Our showroom is at 61 Ubi Avenue 1, #01-05, Singapore. Open daily 11am-7pm!'
  ];
  
  const userIndex = Math.floor(Math.random() * users.length);
  const messageIndex = Math.floor(Math.random() * messages.length);
  const userId = `user_${userIndex}`;
  const responseTime = 100 + Math.random() * 400;
  
  // Record in metrics
  metricsCollector.recordMessage(userId, Date.now(), responseTime);
  
  // Send to admin via Socket.io
  const messageData = {
    userId,
    userName: users[userIndex],
    messageText: messages[messageIndex],
    responseText: responses[messageIndex],
    responseTime: Math.round(responseTime)
  };
  
  console.log(`💬 Simulated message from ${users[userIndex]} (${Math.round(responseTime)}ms)`);
  adminSocketClient.sendMessageProcessed(messageData);
};

// Send metrics every 5 seconds
setInterval(sendMetrics, 5000);

// Simulate messages every 2-8 seconds
const scheduleNextMessage = () => {
  const delay = 2000 + Math.random() * 6000;
  setTimeout(() => {
    simulateMessage();
    scheduleNextMessage();
  }, delay);
};

// Start message simulation after 2 seconds
setTimeout(() => {
  console.log('\n💬 Starting message simulation...');
  scheduleNextMessage();
}, 2000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down monitoring test...');
  adminSocketClient.disconnect();
  process.exit(0);
});

console.log('\n✨ Monitoring test is running. Press Ctrl+C to stop.');