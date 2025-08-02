const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const queries = require('./db/queries');

let io;

const initializeWebSocket = (server) => {
  // Configure Socket.io with proper path handling
  // In production, DigitalOcean strips /api prefix, so Socket.io should use /socket.io/
  const socketPath = '/socket.io/';
  
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://essen-messenger-bot-zxxtw.ondigitalocean.app', 'https://*.ondigitalocean.app']
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: socketPath,
    // Allow Socket.io to serve its client files
    serveClient: true,
    // Add trailing slash handling
    addTrailingSlash: true,
    // Configure transports
    transports: ['polling', 'websocket']
  });
  
  console.log(`Socket.io initialized with path: ${socketPath}`);

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Admin user connected: ${socket.username}`);

    // Join admin room
    socket.join('admins');

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Admin user disconnected: ${socket.username}`);
    });

    // Subscribe to specific events
    socket.on('subscribe', (events) => {
      if (Array.isArray(events)) {
        events.forEach(event => {
          socket.join(event);
        });
      }
    });

    // Unsubscribe from events
    socket.on('unsubscribe', (events) => {
      if (Array.isArray(events)) {
        events.forEach(event => {
          socket.leave(event);
        });
      }
    });
    
    // Handle bot events (from main bot without authentication)
    socket.on('conversation:new', (data) => {
      console.log('Bot event received: conversation:new');
      emitToAdmins('conversation:new', data);
      emitToRoom('conversations', 'conversation:new', data);
    });
    
    socket.on('user:new', (data) => {
      console.log('Bot event received: user:new');
      emitToAdmins('user:new', data);
      emitToRoom('users', 'user:new', data);
    });
  });

  // Create a separate namespace for bot connections (no auth required)
  const botNamespace = io.of('/bot-connection');
  
  botNamespace.on('connection', (socket) => {
    console.log('Bot connected to admin server');
    
    // Handle bot events
    socket.on('conversation:new', (data) => {
      console.log('Bot event received: conversation:new');
      emitToAdmins('conversation:new', data);
      emitToRoom('conversations', 'conversation:new', data);
    });
    
    socket.on('user:new', (data) => {
      console.log('Bot event received: user:new');
      emitToAdmins('user:new', data);
      emitToRoom('users', 'user:new', data);
    });
    
    socket.on('appointment:new', (data) => {
      console.log('Bot event received: appointment:new');
      emitToAdmins('appointment:new', data);
      emitToRoom('appointments', 'appointment:new', data);
    });
    
    socket.on('disconnect', () => {
      console.log('Bot disconnected from admin server');
    });
  });

  return io;
};

// Emit events to admin clients
const emitToAdmins = (event, data) => {
  if (io) {
    io.to('admins').emit(event, data);
  }
};

// Emit to specific rooms
const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

// Bot event handlers - to be called from main bot
const botEventHandlers = {
  newConversation: (conversationData) => {
    emitToAdmins('conversation:new', conversationData);
    emitToRoom('conversations', 'conversation:new', conversationData);
  },

  newUser: (userData) => {
    emitToAdmins('user:new', userData);
    emitToRoom('users', 'user:new', userData);
  },

  newAppointment: (appointmentData) => {
    emitToAdmins('appointment:new', appointmentData);
    emitToRoom('appointments', 'appointment:new', appointmentData);
  },

  statsUpdate: (stats) => {
    emitToAdmins('stats:update', stats);
  },

  systemStatus: (status) => {
    emitToAdmins('system:status', status);
  }
};

module.exports = {
  initializeWebSocket,
  emitToAdmins,
  emitToRoom,
  botEventHandlers
};