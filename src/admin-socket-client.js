// Socket.io client for connecting bot to admin backend
const io = require('socket.io-client');

class AdminSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.messageStreamClients = [];
  }
  
  connect() {
    // Determine admin backend URL based on environment
    // In DigitalOcean, services communicate via public URLs
    const adminUrl = process.env.ADMIN_BACKEND_URL || 
                    (process.env.NODE_ENV === 'production' 
                      ? 'https://essen-messenger-bot-zxxtw.ondigitalocean.app/api' // Production admin API
                      : 'http://localhost:4000');
    
    console.log('🔌 Attempting to connect to admin backend:', adminUrl);
    console.log('Environment:', process.env.NODE_ENV);
    
    // In production, Socket.io path includes /api prefix
    const socketPath = process.env.NODE_ENV === 'production' 
                      ? '/api/socket.io/' 
                      : '/socket.io/';
    
    this.socket = io(adminUrl, {
      auth: {
        service: 'bot',
        secret: process.env.INTERNAL_SECRET || 'bot-service'
      },
      path: socketPath,
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
      transports: ['polling', 'websocket'] // Polling first for DigitalOcean compatibility
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to admin backend via Socket.io');
      console.log('Socket ID:', this.socket.id);
      this.connected = true;
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from admin backend:', reason);
      this.connected = false;
    });
    
    this.socket.on('connect_error', (error) => {
      console.log('⚠️ Socket.io connection error:', error.message);
      console.log('Error type:', error.type);
    });
    
    this.socket.on('error', (error) => {
      console.log('❌ Socket.io error:', error.message);
    });
  }
  
  // Emit metrics update
  sendMetrics(metrics) {
    if (this.connected && this.socket) {
      this.socket.emit('metrics:update', metrics);
    }
  }
  
  // Emit when a message is processed
  sendMessageProcessed(messageData) {
    if (this.connected && this.socket) {
      this.socket.emit('message:processed', {
        user_id: messageData.userId,
        user_name: messageData.userName,
        message_text: messageData.messageText,
        response_text: messageData.responseText,
        response_time: messageData.responseTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // Also send to SSE clients
    this.broadcastToMessageStream(messageData);
  }
  
  // Emit health status changes
  sendHealthUpdate(healthStatus) {
    if (this.connected && this.socket) {
      this.socket.emit('health:changed', healthStatus);
    }
  }
  
  // Register SSE client for message stream
  addMessageStreamClient(res) {
    this.messageStreamClients.push(res);
  }
  
  // Remove SSE client
  removeMessageStreamClient(res) {
    const index = this.messageStreamClients.indexOf(res);
    if (index > -1) {
      this.messageStreamClients.splice(index, 1);
    }
  }
  
  // Broadcast to all SSE clients
  broadcastToMessageStream(messageData) {
    const data = JSON.stringify({
      type: 'message',
      user_id: messageData.userId,
      user_name: messageData.userName,
      message_text: messageData.messageText,
      response_text: messageData.responseText,
      response_time: messageData.responseTime,
      timestamp: new Date().toISOString()
    });
    
    this.messageStreamClients.forEach(client => {
      client.write(`data: ${data}\n\n`);
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}

// Singleton instance
const adminSocketClient = new AdminSocketClient();

module.exports = adminSocketClient;