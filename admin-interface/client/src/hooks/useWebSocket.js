import { useEffect, useRef, useCallback } from 'react'
import io from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

// Socket URL configuration for DigitalOcean App Platform
const SOCKET_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
  const isProduction = apiUrl.includes('ondigitalocean.app')
  
  if (isProduction) {
    // In production with App Platform, use the same base URL
    // Socket.io will connect through the same API endpoint
    return apiUrl.replace('/api', '')
  } else {
    // In development, connect directly to the admin server
    return 'http://localhost:4000'
  }
})()
const isProduction = import.meta.env.VITE_API_URL?.includes('ondigitalocean.app')

export const useWebSocket = (events = []) => {
  const socketRef = useRef(null)
  const { user } = useAuth()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!user || !token) return

    // Initialize socket connection with production-friendly settings
    socketRef.current = io(SOCKET_URL, {
      auth: {
        token: token
      },
      path: isProduction ? '/api/socket.io/' : '/socket.io/',
      transports: isProduction ? ['polling', 'websocket'] : ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
      autoConnect: true
    })

    const socket = socketRef.current

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected')
      // Subscribe to events
      if (events.length > 0) {
        socket.emit('subscribe', events)
      }
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message)
      console.error('Socket URL:', SOCKET_URL)
      console.error('Socket path:', isProduction ? '/api/socket.io/' : '/socket.io/')
      console.error('Is production:', isProduction)
      console.error('Full error:', error)
    })

    socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error)
    })

    // Cleanup on unmount
    return () => {
      if (events.length > 0) {
        socket.emit('unsubscribe', events)
      }
      socket.disconnect()
    }
  }, [user, token, events.join(',')])

  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }, [])

  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }, [])

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data)
    }
  }, [])

  return { on, off, emit, socket: socketRef.current }
}