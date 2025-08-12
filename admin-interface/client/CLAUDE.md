# Admin Interface Client - CLAUDE.md

React frontend application for the ESSEN Bot admin dashboard.

## Structure

```
client/
├── src/
│   ├── components/        # Reusable React components
│   ├── context/           # React context providers  
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Main page components
│   ├── services/          # API service layer
│   ├── styles/            # Global styles and themes
│   └── utils/             # Utility functions
├── public/                # Static assets
├── routes/                # Route configurations
└── middleware/            # Build and development middleware
```

## Technology Stack

- **React 18**: Latest React with concurrent features
- **Vite**: Lightning-fast build tool and dev server
- **Material-UI (MUI v5)**: Modern Material Design components
- **React Router v6**: Declarative routing
- **Socket.io Client**: Real-time WebSocket communication
- **Axios**: Promise-based HTTP client
- **React Hook Form**: Performant form handling
- **Date-fns**: Modern date utility library

## Key Components

### Pages (`src/pages/`)
- **Dashboard**: Main overview with key metrics (bot health, message volume, active users, error tracking)
- **Users**: User management and conversation history
- **Analytics**: Essential bot performance metrics
- **KnowledgeBase**: Edit bot responses and product catalog
- **Settings**: System configuration and preferences

### Components (`src/components/`)
- **Layout**: Main application layout with navigation
- **Charts**: Data visualization components
- **Forms**: Reusable form components with validation
- **Tables**: Data tables with sorting, filtering, pagination
- **Modals**: Modal dialogs for actions and confirmations
- **Notifications**: Toast and alert components

### Services (`src/services/`)
- **api.js**: Axios configuration and interceptors
- **auth.js**: Authentication service methods
- **socket.js**: Socket.io client setup and event handlers
- **dashboard.js**: Dashboard data fetching
- **users.js**: User management API calls
- **analytics.js**: Analytics data service

### Context (`src/context/`)
- **AuthContext**: User authentication state
- **ThemeContext**: Material-UI theme management
- **SocketContext**: WebSocket connection state
- **NotificationContext**: Global notification system

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Type checking (if using TypeScript)
npm run type-check
```

## Environment Variables

Create `.env` file in client directory:
```env
VITE_API_BASE_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

## Features

### Authentication
- Login form with JWT token handling
- Protected routes requiring authentication
- Automatic token refresh
- Logout with token cleanup

### Real-time Updates
- Live conversation monitoring
- Real-time user activity indicators
- Auto-refreshing dashboard metrics
- WebSocket connection status indicator

### Data Visualization
- Interactive charts for analytics
- Real-time data updates
- Responsive design for mobile/tablet
- Export capabilities for reports

### User Experience
- Material-UI's consistent design system
- Responsive layout for all screen sizes
- Loading states and error handling
- Smooth transitions and animations
- Accessibility compliance (WCAG 2.1)

## API Integration

The client communicates with the Express backend at `http://localhost:4000`:
- RESTful API for data operations
- WebSocket for real-time updates
- JWT authentication on all requests
- Automatic error handling and retry logic

## Build Configuration

Vite configuration (`vite.config.js`):
- Hot Module Replacement (HMR)
- Optimized production builds
- Automatic code splitting
- Environment variable handling
- Proxy configuration for development

## Styling Approach

- Material-UI's sx prop for component styling
- Global theme configuration
- Responsive breakpoints
- Dark/light theme support
- Custom color palette for ESSEN branding

## State Management

- React Context for global state
- Local component state with useState/useReducer
- Custom hooks for complex state logic
- Socket.io integration for real-time state

## Security Considerations

- JWT tokens stored in memory (not localStorage)
- XSS protection with sanitized inputs
- HTTPS enforcement in production
- Content Security Policy headers
- Input validation on all forms