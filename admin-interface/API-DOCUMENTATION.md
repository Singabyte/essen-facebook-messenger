# Admin Interface API Documentation

Base URL: `https://admin.yourdomain.com/api`

## Authentication

All endpoints except `/auth/login` and `/auth/register` require authentication.

Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /auth/login
Login to the admin interface.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

#### POST /auth/register
Register a new admin user (first-time setup only).

**Request:**
```json
{
  "username": "admin",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "userId": 1
}
```

#### GET /auth/validate
Validate current token.

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### Users

#### GET /users
Get all bot users with pagination.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` - Search by name

**Response:**
```json
{
  "users": [
    {
      "id": "123456789",
      "name": "John Doe",
      "profile_pic": "https://...",
      "created_at": "2024-01-01T00:00:00Z",
      "last_interaction": "2024-01-02T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

#### GET /users/:id
Get specific user details.

**Response:**
```json
{
  "user": {
    "id": "123456789",
    "name": "John Doe",
    "profile_pic": "https://...",
    "created_at": "2024-01-01T00:00:00Z",
    "last_interaction": "2024-01-02T00:00:00Z"
  }
}
```

#### GET /users/:id/conversations
Get user's conversation history.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)

**Response:**
```json
{
  "conversations": [
    {
      "id": 1,
      "user_id": "123456789",
      "message": "Hello",
      "response": "Hi! How can I help?",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### Conversations

#### GET /conversations
Get all conversations with filters.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `userId` - Filter by user
- `startDate` - ISO date string
- `endDate` - ISO date string

**Response:**
```json
{
  "conversations": [
    {
      "id": 1,
      "user_id": "123456789",
      "user_name": "John Doe",
      "message": "What products do you have?",
      "response": "We offer a wide range...",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1000,
  "page": 1,
  "limit": 20
}
```

#### GET /conversations/search
Search conversations by content.

**Query Parameters:**
- `q` - Search query
- `page` (default: 1)
- `limit` (default: 20)

**Response:**
```json
{
  "results": [...],
  "total": 10,
  "query": "products"
}
```

#### GET /conversations/stats
Get conversation statistics.

**Response:**
```json
{
  "totalConversations": 5000,
  "todayConversations": 123,
  "averageResponseTime": 1500,
  "popularCommands": [
    {
      "message": "/products",
      "count": 450
    }
  ]
}
```

### Appointments

#### GET /appointments
Get all appointments.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `startDate` - ISO date string
- `endDate` - ISO date string

**Response:**
```json
{
  "appointments": [
    {
      "id": 1,
      "user_id": "123456789",
      "facebook_name": "John Doe",
      "appointment_date": "2024-01-15",
      "appointment_time": "14:00",
      "phone_number": "+65 1234 5678",
      "status": "pending",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

#### GET /appointments/:id
Get specific appointment.

#### PATCH /appointments/:id/status
Update appointment status.

**Request:**
```json
{
  "status": "confirmed"
}
```

### Analytics

#### GET /analytics/overview
Get analytics overview.

**Query Parameters:**
- `startDate` - ISO date string
- `endDate` - ISO date string

**Response:**
```json
{
  "totalUsers": 1000,
  "activeUsers": 250,
  "totalConversations": 5000,
  "totalAppointments": 100,
  "averageResponseTime": 1500,
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }
}
```

#### GET /analytics/timeline
Get conversation timeline data.

**Query Parameters:**
- `period` - "7d", "30d", "90d"

**Response:**
```json
{
  "timeline": [
    {
      "date": "2024-01-01",
      "count": 150
    }
  ],
  "period": "7d"
}
```

#### GET /analytics/commands
Get command usage statistics.

**Response:**
```json
{
  "commands": [
    {
      "command": "/products",
      "count": 450,
      "percentage": 25.5
    }
  ],
  "total": 1765
}
```

### Knowledge Base

#### GET /knowledge-base/files
Get available knowledge base files.

**Response:**
```json
{
  "files": [
    {
      "id": "main",
      "name": "essen-chatbot-kb.md",
      "path": "/path/to/file"
    }
  ]
}
```

#### GET /knowledge-base/files/:id
Get file content.

**Response:**
```json
{
  "id": "main",
  "filename": "essen-chatbot-kb.md",
  "content": "# ESSEN Knowledge Base\n...",
  "lastModified": "2024-01-01T00:00:00Z"
}
```

#### PUT /knowledge-base/files/:id
Update file content.

**Request:**
```json
{
  "content": "# Updated ESSEN Knowledge Base\n..."
}
```

**Response:**
```json
{
  "message": "File updated successfully",
  "backup": "/path/to/backup.1234567890"
}
```

#### GET /knowledge-base/files/:id/history
Get file version history.

**Response:**
```json
{
  "history": [
    {
      "version": 1,
      "timestamp": "2024-01-01T00:00:00Z",
      "changes": "Initial version"
    }
  ]
}
```

## WebSocket Events

Connect to WebSocket at `wss://admin.yourdomain.com/socket.io`

### Authentication
Include token in connection:
```javascript
const socket = io('wss://admin.yourdomain.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Subscribe to events
```javascript
socket.emit('subscribe', ['conversations', 'appointments']);
```

#### Incoming events

**conversation:new**
```json
{
  "id": 123,
  "user_id": "123456789",
  "user_name": "John Doe",
  "message": "Hello",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**user:new**
```json
{
  "id": "123456789",
  "name": "John Doe",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**appointment:new**
```json
{
  "id": 1,
  "user_id": "123456789",
  "facebook_name": "John Doe",
  "appointment_date": "2024-01-15",
  "appointment_time": "14:00"
}
```

**stats:update**
```json
{
  "totalConversations": 5001,
  "todayConversations": 124,
  "activeUsers": 251
}
```

**system:status**
```json
{
  "bot": {
    "status": "online",
    "lastPing": "2024-01-01T00:00:00Z"
  },
  "database": {
    "status": "connected",
    "responseTime": 45
  }
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "message": "Error description",
  "error": "Detailed error (development only)",
  "stack": "Stack trace (development only)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited to 100 requests per 15 minutes per IP.

Rate limit headers:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp