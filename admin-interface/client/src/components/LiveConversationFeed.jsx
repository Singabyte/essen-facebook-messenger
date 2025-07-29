import React, { useState, useEffect, useRef } from 'react'
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Badge,
  Tooltip,
} from '@mui/material'
import {
  Person,
  Chat,
  NotificationsActive,
  NotificationsOff,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { useWebSocket } from '../hooks/useWebSocket'

function LiveConversationFeed() {
  const [conversations, setConversations] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const { on, off } = useWebSocket(['conversations'])
  const audioRef = useRef(new Audio('/notification.mp3'))

  useEffect(() => {
    const handleNewConversation = (data) => {
      setConversations(prev => [data, ...prev].slice(0, 10)) // Keep last 10
      setNewCount(prev => prev + 1)
      
      if (soundEnabled) {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e))
      }
    }

    on('conversation:new', handleNewConversation)

    return () => {
      off('conversation:new', handleNewConversation)
    }
  }, [on, off, soundEnabled])

  useEffect(() => {
    // Clear count after 3 seconds
    if (newCount > 0) {
      const timer = setTimeout(() => setNewCount(0), 3000)
      return () => clearTimeout(timer)
    }
  }, [newCount])

  return (
    <Paper sx={{ p: 2, height: '400px', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Badge badgeContent={newCount} color="primary">
          <Typography variant="h6">
            Live Conversations
          </Typography>
        </Badge>
        <Tooltip title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}>
          <IconButton
            size="small"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <NotificationsActive /> : <NotificationsOff />}
          </IconButton>
        </Tooltip>
      </Box>
      
      {conversations.length === 0 ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          flexGrow={1}
        >
          <Typography color="text.secondary">
            Waiting for new conversations...
          </Typography>
        </Box>
      ) : (
        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {conversations.map((conv, index) => (
            <ListItem
              key={`${conv.id}-${index}`}
              alignItems="flex-start"
              sx={{
                bgcolor: index === 0 && newCount > 0 ? 'action.hover' : 'transparent',
                transition: 'background-color 0.3s',
              }}
            >
              <ListItemAvatar>
                <Avatar>
                  <Person />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">
                      {conv.user_name || 'Unknown User'}
                    </Typography>
                    <Chip
                      label="NEW"
                      size="small"
                      color="primary"
                      sx={{ display: index === 0 && newCount > 0 ? 'flex' : 'none' }}
                    />
                  </Box>
                }
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.primary"
                      sx={{ display: 'block' }}
                    >
                      {conv.message?.substring(0, 100)}
                      {conv.message?.length > 100 && '...'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(conv.timestamp || Date.now()), 'HH:mm:ss')}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  )
}

export default LiveConversationFeed