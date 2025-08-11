import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No auth token found, skipping socket connection');
      return;
    }

    // Determine the socket URL based on environment
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const isProduction = apiUrl.includes('ondigitalocean.app');
    
    // In production, we need to use the full URL with /api path
    // In development, we connect directly to the server
    const socketUrl = isProduction 
      ? apiUrl.replace('/api', '') // Base URL for production
      : 'http://localhost:4000';
    
    // Configure Socket.io path based on environment
    // In production, DigitalOcean routes /api/* to the admin-api service
    const socketPath = isProduction ? '/api/socket.io/' : '/socket.io/';

    console.log('Connecting to socket server:', {
      url: socketUrl,
      path: socketPath,
      environment: isProduction ? 'production' : 'development'
    });

    // Create socket connection with authentication
    const newSocket = io(socketUrl, {
      auth: {
        token: token
      },
      path: socketPath,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Authentication error handling
    newSocket.on('authentication_error', () => {
      console.error('Socket authentication failed');
      setConnected(false);
      // Optionally redirect to login
      // window.location.href = '/login';
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('Disconnecting socket');
      newSocket.disconnect();
    };
  }, []); // Only run once on mount

  const value = {
    socket,
    connected,
    emit: (event, data) => {
      if (socket && connected) {
        socket.emit(event, data);
      } else {
        console.warn('Socket not connected, cannot emit:', event);
      }
    },
    on: (event, handler) => {
      if (socket) {
        socket.on(event, handler);
      }
    },
    off: (event, handler) => {
      if (socket) {
        socket.off(event, handler);
      }
    }
  };

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;