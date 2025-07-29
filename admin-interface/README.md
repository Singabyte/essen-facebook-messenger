# ESSEN Bot Admin Interface

A web-based management interface for the ESSEN Facebook Messenger bot.

## Features

- **Dashboard**: Real-time analytics and bot metrics
- **User Management**: View and manage bot users
- **Conversation Viewer**: Browse and search chat history
- **Knowledge Base Editor**: Edit bot knowledge files
- **Appointments**: Manage consultation appointments
- **Analytics**: Usage statistics and insights

## Tech Stack

- **Frontend**: React + Vite + Material-UI
- **Backend**: Express.js + SQLite
- **Authentication**: JWT
- **Real-time**: WebSockets (coming soon)

## Getting Started

### Prerequisites

- Node.js 18+
- Main bot application running
- SQLite database (`database/bot.db`)

### Installation

1. **Install dependencies**:
   ```bash
   # Frontend
   cd admin-interface/client
   npm install
   
   # Backend
   cd ../server
   npm install
   ```

2. **Configure environment**:
   - Update `server/.env` with your settings
   - Update `client/.env` if needed

3. **Create admin user**:
   ```bash
   # Start the server first
   cd server
   npm run dev
   
   # In another terminal, create admin user
   curl -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-secure-password"}'
   ```

### Running the Application

1. **Start the backend**:
   ```bash
   cd admin-interface/server
   npm run dev
   ```

2. **Start the frontend**:
   ```bash
   cd admin-interface/client
   npm run dev
   ```

3. **Access the interface**:
   Open http://localhost:5173 in your browser

## Development

### Frontend Structure
```
client/src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── services/      # API service functions
├── hooks/         # Custom React hooks
├── context/       # React context providers
└── styles/        # Global styles
```

### Backend Structure
```
server/src/
├── routes/        # API route handlers
├── middleware/    # Express middleware
├── db/           # Database connection and queries
└── utils/        # Utility functions
```

### API Endpoints

- `POST /api/auth/login` - User login
- `GET /api/users` - List users
- `GET /api/conversations` - List conversations
- `GET /api/appointments` - List appointments
- `GET /api/analytics/overview` - Analytics data
- `GET /api/knowledge-base/files` - KB files

## Security

- JWT authentication required for all API endpoints
- Rate limiting enabled
- CORS configured for frontend origin
- Input validation on all endpoints

## Next Steps

- Complete Phase 2: Authentication UI
- Implement WebSocket for real-time updates
- Add comprehensive error handling
- Create user documentation