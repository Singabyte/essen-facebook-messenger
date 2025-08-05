const io = require('socket.io-client');
const { loadKnowledgeBase } = require('./geminiClient');

let adminSocket = null;
let isConnected = false;

// Initialize connection to admin server
const initializeAdminSocket = () => {
  // Delay initialization to ensure admin server is ready
  setTimeout(() => {
    // Only connect if admin URL is configured
    const adminUrl = process.env.ADMIN_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');
    
    if (!adminUrl && process.env.NODE_ENV === 'production') {
      console.log('Admin Socket.io client disabled - ADMIN_API_URL not set');
      return;
    }

    // In production with App Platform, use the base URL for admin API
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? process.env.APP_URL || 'https://essen-messenger-bot-zxxtw.ondigitalocean.app'
      : adminUrl;

    console.log('Initializing admin Socket.io client...');
    console.log('Connecting to admin server:', socketUrl);

  // Connect to the /bot-connection namespace which doesn't require authentication
  // In production, we need to use /api/socket.io/ for the client path
  const socketPath = process.env.NODE_ENV === 'production' ? '/api/socket.io/' : '/socket.io/';
  const fullSocketUrl = `${socketUrl}/bot-connection`;
  
  adminSocket = io(fullSocketUrl, {
    path: socketPath,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: 5
  });

  adminSocket.on('connect', () => {
    console.log('Connected to admin server');
    isConnected = true;
  });

  adminSocket.on('disconnect', () => {
    console.log('Disconnected from admin server');
    isConnected = false;
  });

  adminSocket.on('connect_error', (error) => {
    console.error('Admin socket connection error:', error.message);
  });

  // Listen for knowledge base reload event
  adminSocket.on('knowledgebase:reload', () => {
    console.log('Received knowledge base reload request from admin');
    const result = loadKnowledgeBase();
    if (result) {
      console.log('Knowledge base reloaded successfully');
      emitToAdmin('knowledgebase:reload:success', { 
        timestamp: new Date().toISOString(),
        message: 'Knowledge base reloaded successfully'
      });
    } else {
      console.error('Failed to reload knowledge base');
      emitToAdmin('knowledgebase:reload:error', { 
        timestamp: new Date().toISOString(),
        message: 'Failed to reload knowledge base'
      });
    }
  });
  }, 5000); // Wait 5 seconds before connecting
};

// Emit events to admin interface
const emitToAdmin = (event, data) => {
  if (adminSocket && isConnected) {
    console.log(`Emitting event '${event}' to admin server:`, JSON.stringify(data).substring(0, 100));
    adminSocket.emit(event, data);
  } else {
    console.log(`Cannot emit '${event}' - Socket not connected. Connected: ${isConnected}, Socket exists: ${!!adminSocket}`);
  }
};

// Event emitters for specific actions
const adminEvents = {
  newConversation: (conversationData) => {
    emitToAdmin('conversation:new', conversationData);
  },

  newUser: (userData) => {
    emitToAdmin('user:new', userData);
  },

  newAppointment: (appointmentData) => {
    emitToAdmin('appointment:new', appointmentData);
  },

  statsUpdate: (stats) => {
    emitToAdmin('stats:update', stats);
  },

  systemStatus: (status) => {
    emitToAdmin('system:status', status);
  }
};

// Disconnect socket
const disconnectAdminSocket = () => {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
    isConnected = false;
  }
};

module.exports = {
  initializeAdminSocket,
  adminEvents,
  disconnectAdminSocket,
  isConnected: () => isConnected
};