const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const queries = require('./db/queries-pg');

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
  // In production, DigitalOcean routes /api/* to admin-api service
  // The client connects with /api/socket.io/ but DigitalOcean strips the /api prefix
  // So the server should still use /socket.io/
  const socketPath = '/socket.io/';
  
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://essen-messenger-bot-zxxtw.ondigitalocean.app',
            'https://*.ondigitalocean.app',
            process.env.FRONTEND_URL,
            process.env.APP_URL,
            'http://localhost:3000', // Bot service internal communication
            'http://facebook-bot:3000' // DigitalOcean internal service name
          ].filter(Boolean)
        : (origin, callback) => {
            // Allow any localhost port in development
            if (!origin || origin.startsWith('http://localhost:')) {
              callback(null, true);
            } else {
              callback(null, false);
            }
          },
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['content-type', 'authorization']
    },
    path: socketPath,
    // Allow Socket.io to serve its client files
    serveClient: true,
    // Add trailing slash handling
    addTrailingSlash: false,
    // Configure transports
    transports: ['polling', 'websocket'],
    // Allow EIO3 and EIO4 clients
    allowEIO3: true
  });
  
  console.log(`Socket.io initialized with path: ${socketPath}`);

  // Authentication middleware - allow bot service or admin users
  io.use(async (socket, next) => {
    try {
      // Check if it's the bot service
      if (socket.handshake.auth.service === 'bot') {
        socket.isBot = true;
        socket.username = 'bot-service';
        return next();
      }
      
      // Otherwise, require JWT token for admin users
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.isBot = false;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`${socket.isBot ? 'Bot service' : 'Admin user'} connected: ${socket.username}`);

    // Bot service handlers
    if (socket.isBot) {
      console.log('✅ Bot service connected - setting up event handlers');
      console.log('Bot socket ID:', socket.id);
      
      // Handle metrics updates from bot
      socket.on('metrics:update', (metrics) => {
        console.log('📊 Received metrics:update from bot:', metrics.timestamp);
        // Broadcast to all admin clients
        io.to('admins').emit('metrics:update', metrics);
        io.to('monitoring').emit('metrics:update', metrics);
        console.log('📡 Broadcasted metrics to admins and monitoring rooms');
      });
      
      // Handle processed messages from bot
      socket.on('message:processed', (messageData) => {
        console.log('💬 Received message:processed from bot:', messageData.user_id);
        // Broadcast to all admin clients
        io.to('admins').emit('message:new', messageData);
        io.to('monitoring').emit('message:new', messageData);
        
        // Also emit to user-specific room
        io.to(`user-${messageData.user_id}`).emit('message:new', messageData);
        console.log('📡 Broadcasted message to admins, monitoring, and user rooms');
      });
      
      // Handle health status changes
      socket.on('health:changed', (healthStatus) => {
        console.log('🏥 Received health:changed from bot');
        io.to('admins').emit('health:changed', healthStatus);
        io.to('monitoring').emit('health:changed', healthStatus);
      });
      
      socket.on('disconnect', () => {
        console.log('❌ Bot service disconnected');
      });
      
      return; // Don't continue with admin-specific setup
    }

    // Join admin room for admin users only
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

  // Removed duplicate bot-connection namespace - using main namespace with auth instead
  // Bot connects through main namespace with auth: { service: 'bot' }

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