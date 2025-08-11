# Admin Interface - CLAUDE.md

This directory contains the admin dashboard system for the ESSEN Facebook Messenger Bot.

## Structure

```
admin-interface/
├── client/                    # React frontend application
└── server/                    # Express backend API
```

## Overview

The admin interface provides a comprehensive web-based dashboard for managing the ESSEN bot. It consists of:

1. **Client (React Frontend)**: A modern React application built with Vite and Material-UI
2. **Server (Express Backend)**: RESTful API with JWT authentication and real-time updates

## Key Features

- **Dashboard**: Overview of bot performance, user metrics, and system health
- **User Management**: View and manage bot users, their preferences, and conversation history
- **Conversation Viewer**: Real-time conversation monitoring and analytics
- **Knowledge Base Editor**: Modify ESSEN product catalog and bot responses
- **Appointment Management**: View, manage, and track customer appointments
- **Analytics**: Detailed metrics on bot usage, popular products, and user engagement
- **Real-time Updates**: WebSocket integration for live data updates

## Technology Stack

### Frontend (Client)
- **React 18**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **Material-UI (MUI)**: Professional React UI components
- **Socket.io Client**: Real-time communication with backend
- **Axios**: HTTP client for API calls
- **React Router**: Client-side routing

### Backend (Server)
- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional communication
- **JWT**: JSON Web Token authentication
- **PostgreSQL/SQLite**: Database integration (matches main bot database)
- **Cors**: Cross-origin resource sharing middleware

## Environment Setup

### Client
```bash
cd admin-interface/client
npm install
npm run dev  # Starts on port 5173
```

### Server
```bash
cd admin-interface/server
npm install
npm run dev  # Starts on port 4000
```

## Authentication

The admin interface uses JWT-based authentication:
- Admin users are created via `create-admin-pg.js` script
- JWT tokens are required for all API endpoints (except login)
- Token expiration and refresh handling

## Database Integration

The admin interface shares the same database as the main bot application:
- Reads conversation data, user information, and analytics
- Can modify knowledge base and user preferences
- Maintains data consistency with the bot's operational database

## API Endpoints

Key API routes (detailed in each subfolder):
- `/api/auth/*` - Authentication endpoints
- `/api/dashboard/*` - Dashboard data and metrics
- `/api/users/*` - User management
- `/api/conversations/*` - Conversation history
- `/api/analytics/*` - Analytics and reporting
- `/api/knowledge-base/*` - Knowledge base management

## Real-time Features

WebSocket connections provide:
- Live conversation monitoring
- Real-time user activity updates
- System health notifications
- Auto-refreshing analytics data

## Development Notes

- The client and server can be developed independently
- Hot reload is enabled for both frontend and backend
- Shared knowledge base files are synchronized between main bot and admin interface
- CORS is configured for development (localhost:5173 to localhost:4000)

## Security Considerations

- JWT secret must be configured in server environment
- Admin user creation requires database access
- All sensitive operations require authentication
- Input validation on all API endpoints
- Rate limiting on authentication endpoints