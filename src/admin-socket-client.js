const io = require('socket.io-client');

let adminSocket = null;
let isConnected = false;

// Initialize connection to admin server
const initializeAdminSocket = () => {
  // Only connect if admin URL is configured
  const adminUrl = process.env.ADMIN_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');
  
  if (!adminUrl && process.env.NODE_ENV === 'production') {
    console.log('Admin Socket.io client disabled - ADMIN_API_URL not set');
    return;
  }

  // In production with App Platform, use the same base URL with /admin path
  const socketUrl = process.env.NODE_ENV === 'production' 
    ? `${process.env.APP_URL || 'https://essen-messenger-bot-zxxtw.ondigitalocean.app'}/admin`
    : adminUrl;

  console.log('Connecting to admin server:', socketUrl);

  // Connect to the /bot namespace which doesn't require authentication
  const socketPath = process.env.NODE_ENV === 'production' ? '/admin/socket.io/' : '/socket.io/';
  const fullSocketUrl = `${socketUrl}/bot`;
  
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
};

// Emit events to admin interface
const emitToAdmin = (event, data) => {
  if (adminSocket && isConnected) {
    adminSocket.emit(event, data);
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