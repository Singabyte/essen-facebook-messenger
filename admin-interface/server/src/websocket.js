const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const queries = require('./db/queries');

let io;
const activeUsersToday = new Set(); // Track active users for today
const todayConversationCount = { count: 0, date: new Date().toDateString() };

// Reset daily counters at midnight
const resetDailyCounters = () => {
  const now = new Date();
  if (now.toDateString() !== todayConversationCount.date) {
    activeUsersToday.clear();
    todayConversationCount.count = 0;
    todayConversationCount.date = now.toDateString();
    console.log('Daily counters reset for new day:', now.toDateString());
  }
};

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
    console.log(`Socket ${socket.id} joined 'admins' room`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Admin user disconnected: ${socket.username}`);
    });

    // Subscribe to specific events
    socket.on('subscribe', (events) => {
      console.log(`Socket ${socket.id} subscribing to:`, events);
      if (Array.isArray(events)) {
        events.forEach(event => {
          socket.join(event);
          console.log(`Socket ${socket.id} joined '${event}' room`);
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
    
    // Join user-specific room for real-time messaging
    socket.on('join-user-room', (userId) => {
      socket.join(`user-${userId}`);
      console.log(`Admin ${socket.username} joined user room: user-${userId}`);
    });
    
    // Leave user-specific room
    socket.on('leave-user-room', (userId) => {
      socket.leave(`user-${userId}`);
      console.log(`Admin ${socket.username} left user room: user-${userId}`);
    });
    
    // Handle admin sending message to user
    socket.on('send-message-to-user', async (data) => {
      const { userId, message } = data;
      console.log(`Admin ${socket.username} sending message to user ${userId}`);
      
      // Broadcast to other admins watching this conversation
      socket.to(`user-${userId}`).emit('admin-message', {
        userId,
        message,
        adminId: socket.userId,
        adminUsername: socket.username,
        timestamp: new Date()
      });
    });
  });

  // Create a separate namespace for bot connections (no auth required)
  const botNamespace = io.of('/bot-connection');
  
  botNamespace.on('connection', (socket) => {
    console.log('Bot connected to admin server');
    
    // Handle bot events
    socket.on('conversation:new', (data) => {
      console.log('Bot event received: conversation:new');
      resetDailyCounters(); // Check if it's a new day
      
      // Track active user
      const wasNewUser = !activeUsersToday.has(data.user_id);
      activeUsersToday.add(data.user_id);
      
      // Increment today's conversation count
      todayConversationCount.count++;
      
      // Emit events
      emitToAdmins('conversation:new', data);
      emitToRoom('conversations', 'conversation:new', data);
      
      // Always emit updated conversation count
      emitToRoom('dashboard', 'stats:update', {
        todayConversations: todayConversationCount.count
      });
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
      
      // Update appointment analytics in real-time
      emitToRoom('analytics', 'appointment:analytics:update', {
        type: 'new_appointment',
        data: data,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('analytics:metric:update', (data) => {
      console.log('Bot event received: analytics:metric:update');
      emitToRoom('analytics', 'metric:update', data);
    });

    socket.on('performance:query', (data) => {
      console.log('Bot event received: performance:query');
      emitToRoom('analytics', 'performance:query', data);
    });
    
    socket.on('disconnect', () => {
      console.log('Bot disconnected from admin server');
    });
  });

  // Start periodic stats updates
  startPeriodicStatsUpdate();
  
  return io;
};

// Periodic stats update function
const startPeriodicStatsUpdate = () => {
  // Initialize counters from database on startup
  const initializeCounters = async () => {
    try {
      const queries = require('./db/queries-pg');
      const overview = await queries.analytics.getOverview();
      
      // Initialize counters with current data
      todayConversationCount.count = overview.totalConversations || 0;
      
      console.log(`Initialized counters - Today's conversations: ${todayConversationCount.count}`);
    } catch (error) {
      console.error('Error initializing counters:', error);
    }
  };
  
  initializeCounters();
  
  // Send periodic updates for dashboard
  setInterval(async () => {
    try {
      resetDailyCounters(); // Check if it's a new day
      
      const queries = require('./db/queries-pg');
      const overview = await queries.analytics.getOverview();
      
      // Emit stats update to dashboard subscribers
      emitToRoom('dashboard', 'stats:update', {
        todayConversations: todayConversationCount.count,
        totalAppointments: overview.totalAppointments,
        activeUsers: overview.activeUsers,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating dashboard stats:', error);
    }
  }, 30000); // Update every 30 seconds

  // Send periodic analytics updates
  setInterval(async () => {
    try {
      const queries = require('./db/queries-pg');
      
      // Get real-time analytics data
      const [
        overview,
        conversionFunnel,
        peakHours,
        satisfaction
      ] = await Promise.all([
        queries.analytics.getOverview(),
        queries.analytics.getConversionFunnel(),
        queries.analytics.getPeakUsageHours(1), // Last hour
        queries.analytics.getUserSatisfactionMetrics(1) // Last day
      ]);

      // Emit analytics updates
      emitToRoom('analytics', 'analytics:realtime:update', {
        overview,
        conversionFunnel,
        currentHourActivity: peakHours[0] || {},
        satisfaction,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  }, 60000); // Update analytics every minute

  // Send performance metrics updates
  setInterval(async () => {
    try {
      const queries = require('./db/queries-pg');
      const [performance, connectionStats] = await Promise.all([
        queries.analytics.getPerformanceMetrics(1), // Last day
        queries.analytics.getDatabaseStats()
      ]);

      emitToRoom('analytics', 'performance:update', {
        metrics: performance,
        connections: connectionStats.connections,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  }, 120000); // Update performance every 2 minutes
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
    const roomSockets = io.sockets.adapter.rooms.get(room);
    const socketCount = roomSockets ? roomSockets.size : 0;
    console.log(`Emitting '${event}' to room '${room}' (${socketCount} sockets)`);
    io.to(room).emit(event, data);
  }
};

// Emit to bot namespace
const emitToBot = (event, data) => {
  if (io) {
    const botNamespace = io.of('/bot-connection');
    console.log(`Emitting '${event}' to bot namespace`);
    botNamespace.emit(event, data);
  }
};

// Bot event handlers - to be called from main bot
const botEventHandlers = {
  newConversation: (conversationData) => {
    emitToAdmins('conversation:new', conversationData);
    emitToRoom('conversations', 'conversation:new', conversationData);
    // Also emit to user-specific room for real-time messaging
    emitToRoom(`user-${conversationData.user_id}`, 'new-message', conversationData);
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
  },

  // New analytics-specific events
  analyticsMetricUpdate: (metricData) => {
    emitToRoom('analytics', 'metric:update', metricData);
  },

  performanceAlert: (alertData) => {
    emitToAdmins('performance:alert', alertData);
    emitToRoom('analytics', 'performance:alert', alertData);
  },

  slowQueryDetected: (queryData) => {
    emitToRoom('analytics', 'slow-query:detected', queryData);
  },

  businessMetricUpdate: (metrics) => {
    emitToRoom('analytics', 'business-metrics:update', metrics);
  },

  realtimeUpdate: (updateData) => {
    emitToRoom('analytics', 'realtime:update', updateData);
  }
};

module.exports = {
  initializeWebSocket,
  emitToAdmins,
  emitToRoom,
  emitToBot,
  botEventHandlers
};