import React, { useState, useEffect } from 'react'
import {
  Paper,
  Typography,
  Box,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  Warning,
  Storage,
  Api,
  Speed,
  Memory,
} from '@mui/icons-material'
import { useWebSocket } from '../hooks/useWebSocket'

function SystemStatusMonitor() {
  const [systemStatus, setSystemStatus] = useState({
    bot: { status: 'online', lastPing: new Date() },
    database: { status: 'connected', responseTime: 50 },
    api: { status: 'healthy', avgResponseTime: 45, requestsPerMinute: 120 },
    memory: { used: 256, total: 512 },
  })
  const [alerts, setAlerts] = useState([])
  const { on, off } = useWebSocket([])

  useEffect(() => {
    const handleStatusUpdate = (data) => {
      setSystemStatus(prev => ({ ...prev, ...data }))
    }

    const handleAlert = (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 5)) // Keep last 5 alerts
    }

    on('system:status', handleStatusUpdate)
    on('system:alert', handleAlert)

    return () => {
      off('system:status', handleStatusUpdate)
      off('system:alert', handleAlert)
    }
  }, [on, off])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'healthy':
        return <CheckCircle color="success" />
      case 'warning':
      case 'degraded':
        return <Warning color="warning" />
      case 'offline':
      case 'error':
      case 'disconnected':
        return <Error color="error" />
      default:
        return <CheckCircle color="action" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'healthy':
        return 'success'
      case 'warning':
      case 'degraded':
        return 'warning'
      case 'offline':
      case 'error':
      case 'disconnected':
        return 'error'
      default:
        return 'default'
    }
  }

  const memoryUsagePercent = (systemStatus.memory.used / systemStatus.memory.total) * 100

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        System Status Monitor
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <List dense>
            <ListItem>
              <ListItemIcon>
                {getStatusIcon(systemStatus.bot.status)}
              </ListItemIcon>
              <ListItemText
                primary="Bot Status"
                secondary={
                  <Chip
                    label={systemStatus.bot.status.toUpperCase()}
                    size="small"
                    color={getStatusColor(systemStatus.bot.status)}
                  />
                }
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                {getStatusIcon(systemStatus.database.status)}
              </ListItemIcon>
              <ListItemText
                primary="Database"
                secondary={
                  <Box>
                    <Chip
                      label={systemStatus.database.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(systemStatus.database.status)}
                    />
                    <Typography variant="caption" display="block">
                      Response time: {systemStatus.database.responseTime}ms
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                {getStatusIcon(systemStatus.api.status)}
              </ListItemIcon>
              <ListItemText
                primary="API Health"
                secondary={
                  <Box>
                    <Chip
                      label={systemStatus.api.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(systemStatus.api.status)}
                    />
                    <Typography variant="caption" display="block">
                      Avg response: {systemStatus.api.avgResponseTime}ms
                    </Typography>
                    <Typography variant="caption" display="block">
                      Requests/min: {systemStatus.api.requestsPerMinute}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          </List>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              Memory Usage
            </Typography>
            <Box display="flex" alignItems="center">
              <Box flexGrow={1} mr={2}>
                <LinearProgress
                  variant="determinate"
                  value={memoryUsagePercent}
                  color={memoryUsagePercent > 80 ? 'error' : memoryUsagePercent > 60 ? 'warning' : 'primary'}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2">
                {systemStatus.memory.used}MB / {systemStatus.memory.total}MB
              </Typography>
            </Box>
          </Box>
          
          {alerts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Recent Alerts
              </Typography>
              {alerts.map((alert, index) => (
                <Alert
                  key={index}
                  severity={alert.severity || 'warning'}
                  sx={{ mb: 1 }}
                >
                  {alert.message}
                </Alert>
              ))}
            </Box>
          )}
        </Grid>
      </Grid>
    </Paper>
  )
}

export default SystemStatusMonitor