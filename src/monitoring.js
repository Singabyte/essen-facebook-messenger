// Simple monitoring module for ESSEN bot
// No error handling, no complexity - just basic metrics

class CircularBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = new Array(size);
    this.pointer = 0;
    this.count = 0;
  }
  
  push(item) {
    this.buffer[this.pointer] = item;
    this.pointer = (this.pointer + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }
  
  getAll() {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    return [...this.buffer.slice(this.pointer), ...this.buffer.slice(0, this.pointer)];
  }

  getLast(n) {
    const all = this.getAll();
    return all.slice(-n);
  }
}

class MetricsCollector {
  constructor() {
    // Simple counters
    this.totalMessages = 0;
    this.totalUsers = new Set();
    this.dailyActiveUsers = new Map();
    
    // Circular buffers for time-series data
    this.messageVolume = new CircularBuffer(24 * 7); // 7 days of hourly data
    this.responseTime = new CircularBuffer(1000);    // Last 1000 response times
    
    // Real-time metrics
    this.activeConnections = 0;
    this.lastHeartbeat = Date.now();
    
    // Hourly message tracking
    this.currentHour = new Date().getHours();
    this.currentHourMessages = 0;
    
    // Start hourly aggregation
    this.startHourlyAggregation();
  }
  
  startHourlyAggregation() {
    // Check every minute if we need to save hourly data
    setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      
      if (currentHour !== this.currentHour) {
        // Save previous hour's data
        this.messageVolume.push({
          hour: this.currentHour,
          date: new Date(now.getTime() - 3600000).toISOString(),
          messages: this.currentHourMessages
        });
        
        // Reset for new hour
        this.currentHour = currentHour;
        this.currentHourMessages = 0;
      }
      
      // Clean up old daily active users (keep last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      for (const [date, users] of this.dailyActiveUsers.entries()) {
        if (new Date(date) < sevenDaysAgo) {
          this.dailyActiveUsers.delete(date);
        }
      }
    }, 60000); // Every minute
  }
  
  recordMessage(userId, timestamp = Date.now(), responseTime = null) {
    this.totalMessages++;
    this.currentHourMessages++;
    
    if (userId) {
      this.totalUsers.add(userId);
      
      // Track daily active users
      const today = new Date().toDateString();
      if (!this.dailyActiveUsers.has(today)) {
        this.dailyActiveUsers.set(today, new Set());
      }
      this.dailyActiveUsers.get(today).add(userId);
    }
    
    if (responseTime) {
      this.responseTime.push(responseTime);
    }
    
    this.lastHeartbeat = Date.now();
  }
  
  getStats() {
    const now = new Date();
    const today = now.toDateString();
    const todayUsers = this.dailyActiveUsers.get(today) || new Set();
    
    // Calculate average response time
    const responseTimes = this.responseTime.getAll();
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    
    // Get last 24 hours of messages
    const last24Hours = this.messageVolume.getLast(24);
    const messages24h = last24Hours.reduce((sum, h) => sum + (h?.messages || 0), 0) + this.currentHourMessages;
    
    // Get active users in last 7 days
    let activeThisWeek = new Set();
    for (const users of this.dailyActiveUsers.values()) {
      users.forEach(u => activeThisWeek.add(u));
    }
    
    return {
      timestamp: now.toISOString(),
      uptime: Math.floor((Date.now() - this.lastHeartbeat) / 1000),
      messages: {
        total: this.totalMessages,
        last_hour: this.currentHourMessages,
        last_24h: messages24h,
        avg_response_time: avgResponseTime
      },
      users: {
        total: this.totalUsers.size,
        active_today: todayUsers.size,
        active_this_week: activeThisWeek.size
      },
      system: {
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        database_connections: 1 // We'll update this when we have DB access
      }
    };
  }
  
  getHourlyMetrics(hours = 24) {
    return this.messageVolume.getLast(hours);
  }
  
  getDailyMetrics(days = 7) {
    const hourly = this.messageVolume.getAll();
    const daily = {};
    
    hourly.forEach(h => {
      if (h) {
        const date = new Date(h.date).toDateString();
        daily[date] = (daily[date] || 0) + h.messages;
      }
    });
    
    // Add current day
    const today = new Date().toDateString();
    daily[today] = (daily[today] || 0) + this.currentHourMessages;
    
    return Object.entries(daily)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, days)
      .map(([date, messages]) => ({ date, messages }));
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

module.exports = {
  metricsCollector,
  CircularBuffer
};