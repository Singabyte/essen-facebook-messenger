# Admin Interface Server - CLAUDE.md

Express.js backend API for the ESSEN Bot admin dashboard.

## Structure

```
server/
├── src/
│   ├── db/                # Database connections and queries
│   ├── middleware/        # Express middleware functions
│   └── routes/            # API route handlers
├── scripts/               # Utility scripts
└── middleware/            # Build-time middleware
```

## Technology Stack

- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional communication
- **JWT**: JSON Web Token authentication
- **bcrypt**: Password hashing
- **PostgreSQL/SQLite**: Database integration
- **Cors**: Cross-origin resource sharing
- **Helmet**: Security middleware
- **Morgan**: HTTP request logging

## Core Features

### Authentication & Authorization
- JWT-based authentication system
- Password hashing with bcrypt
- Protected routes with middleware
- Admin user management
- Token expiration and refresh

### Database Integration
- Shared database connection with main bot
- PostgreSQL for production, SQLite for development
- Connection pooling for performance
- Transaction support for data consistency
- Database migration scripts

### Real-time Communication
- Socket.io WebSocket server
- Real-time conversation monitoring
- Live user activity broadcasts
- System health notifications
- Auto-reconnection handling

### API Endpoints

#### Authentication (`/api/auth/`)
- `POST /login` - Admin user authentication
- `POST /logout` - Token invalidation
- `GET /verify` - Token verification
- `POST /refresh` - Token refresh

#### Dashboard (`/api/dashboard/`)
- `GET /stats` - Overall bot statistics
- `GET /metrics` - Performance metrics
- `GET /activity` - Recent activity feed
- `GET /health` - System health check

#### Users (`/api/users/`)
- `GET /` - List all bot users
- `GET /:id` - Get specific user details
- `GET /:id/conversations` - User conversation history
- `PUT /:id/preferences` - Update user preferences
- `DELETE /:id` - Remove user (soft delete)

#### Conversations (`/api/conversations/`)
- `GET /` - List recent conversations
- `GET /:id` - Get conversation details
- `GET /search` - Search conversations
- `POST /:id/notes` - Add admin notes

#### Analytics (`/api/analytics/`)
- `GET /usage` - Bot usage statistics
- `GET /metrics` - Essential bot performance metrics

#### Knowledge Base (`/api/knowledge-base/`)
- `GET /` - Get current knowledge base
- `PUT /` - Update knowledge base content
- `POST /reload` - Reload knowledge base in main bot
- `GET /history` - Knowledge base change history

### Database Schema Access

The server accesses the same tables as the main bot:
- `users` - Bot user information
- `conversations` - Message history
- `user_preferences` - User settings
- `analytics` - Event tracking
- `admin_users` - Admin dashboard users

### Middleware Stack

1. **Security Middleware**
   - Helmet for security headers
   - CORS for cross-origin requests
   - Rate limiting for authentication endpoints

2. **Logging Middleware**
   - Morgan for HTTP request logging
   - Custom error logging

3. **Authentication Middleware**
   - JWT token verification
   - Protected route enforcement
   - User context injection

4. **Data Middleware**
   - JSON body parsing
   - URL-encoded data handling
   - Request validation

### Environment Configuration

Required `.env` variables:
```env
PORT=4000                          # Server port
JWT_SECRET=your_jwt_secret_here    # JWT signing secret
DATABASE_URL=postgresql://...      # Database connection
DB_PATH=../database/bot.db         # SQLite fallback path
CORS_ORIGIN=http://localhost:5173  # Frontend URL
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server (nodemon)
npm run dev

# Start production server
npm start

# Create admin user (PostgreSQL)
node create-admin-pg.js

# Copy knowledge base files
node scripts/copy-kb-files.js
```

### WebSocket Events

#### Client → Server
- `join-admin` - Join admin room for broadcasts
- `get-live-stats` - Request real-time statistics
- `monitor-conversations` - Start conversation monitoring

#### Server → Client
- `stats-update` - Updated dashboard statistics
- `new-conversation` - New user conversation started
- `user-activity` - User activity status change
- `system-alert` - System health alerts

### Security Measures

1. **Authentication Security**
   - Bcrypt password hashing (12 rounds)
   - JWT with short expiration times
   - Secure HTTP-only cookies option
   - Rate limiting on login attempts

2. **API Security**
   - Input validation on all endpoints
   - SQL injection prevention
   - XSS protection headers
   - CSRF token support

3. **Database Security**
   - Parameterized queries
   - Connection encryption
   - Principle of least privilege
   - Audit logging for admin actions

### Error Handling

- Global error handler middleware
- Structured error responses
- Database connection error recovery
- WebSocket error handling
- Logging for debugging and monitoring

### Performance Optimizations

- Database connection pooling
- Query optimization with indexes
- Response caching for static data
- Gzip compression for responses
- Efficient WebSocket event handling

### Integration with Main Bot

- Shares database connection pool
- Can trigger knowledge base reloads
- Monitors bot health and performance
- Accesses same configuration files
- Synchronized user preferences and settings