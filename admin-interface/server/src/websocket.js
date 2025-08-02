const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const queries = require('./db/queries');

let io;

const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : 'http://localhost:5173',
      credentials: true
    },
    path: process.env.NODE_ENV === 'production' ? '/admin/socket.io/' : '/socket.io/'
  });

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