import { useEffect, useRef, useCallback } from 'react'
import io from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

// For production, we need to use the admin API URL, not the main bot URL
const SOCKET_URL = import.meta.env.VITE_ADMIN_API_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'
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
      console.error('Is production:', isProduction)
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