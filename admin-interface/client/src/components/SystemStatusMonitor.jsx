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
  CircularProgress,
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
  const [systemHealth, setSystemHealth] = useState(null)
  const [performanceMetrics, setPerformanceMetrics] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const { on, off } = useWebSocket(['monitoring'])

  useEffect(() => {
    // Fetch initial data
    fetchSystemHealth()
    fetchPerformanceMetrics()
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchSystemHealth()
      fetchPerformanceMetrics()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleStatusUpdate = (data) => {
      setSystemHealth(prev => ({ ...prev, ...data }))
    }

    const handlePerformanceUpdate = (data) => {
      setPerformanceMetrics(prev => ({ ...prev, ...data }))
    }

    const handleAlert = (alert) => {
      setAlerts(prev => [{ ...alert, timestamp: new Date() }, ...prev].slice(0, 5))
    }

    on('system:health', handleStatusUpdate)
    on('system:performance', handlePerformanceUpdate)
    on('system:alert', handleAlert)

    return () => {
      off('system:health', handleStatusUpdate)
      off('system:performance', handlePerformanceUpdate)
      off('system:alert', handleAlert)
    }
  }, [on, off])

  const fetchSystemHealth = async () => {
    try {
      // Try to fetch from bot's health endpoint via proxy
      const response = await fetch('/api/bot-proxy/debug/health-comprehensive')
      if (!response.ok) {
        throw new Error('Failed to fetch health data')
      }
      const data = await response.json()
      setSystemHealth(data)
    } catch (error) {
      console.error('Failed to fetch system health:', error)
      // Fallback to mock data structure
      setSystemHealth({
        overall: 'degraded',
        services: {
          bot: { healthy: false, status: 'error', error: 'Cannot connect to bot service' },
          database: { healthy: true, status: 'connected', responseTime: 45 },
          facebook: { healthy: true, status: 'connected' },
          socketio: { healthy: true, status: 'connected', connected: true }
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/bot-proxy/debug/system-stats')
      if (!response.ok) {
        throw new Error('Failed to fetch performance data')
      }
      const data = await response.json()
      setPerformanceMetrics(data)
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error)
      // Fallback to mock data
      setPerformanceMetrics({
        memoryUsageMB: 256,
        heapUsedMB: 128,
        heapTotalMB: 256,
        uptimeSeconds: 3600
      })
    }
  }

  const getStatusIcon = (healthy, status) => {
    if (healthy === true || status === 'healthy' || status === 'connected' || status === 'operational') {
      return <CheckCircle color="success" />
    } else if (status === 'degraded' || status === 'warning') {
      return <Warning color="warning" />
    } else if (healthy === false || status === 'error' || status === 'disconnected' || status === 'unhealthy') {
      return <Error color="error" />
    } else {
      return <CheckCircle color="action" />
    }
  }

  const getStatusColor = (healthy, status) => {
    if (healthy === true || status === 'healthy' || status === 'connected' || status === 'operational') {
      return 'success'
    } else if (status === 'degraded' || status === 'warning') {
      return 'warning'
    } else if (healthy === false || status === 'error' || status === 'disconnected' || status === 'unhealthy') {
      return 'error'
    } else {
      return 'default'
    }
  }

  const getStatusLabel = (healthy, status) => {
    if (status) return status.toUpperCase()
    return healthy ? 'HEALTHY' : 'UNHEALTHY'
  }

  const memoryUsagePercent = performanceMetrics ? 
    (performanceMetrics.memoryUsageMB / (performanceMetrics.memoryUsageMB + 200)) * 100 : 0

  if (loading) {
    return (
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        System Status Monitor
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <List dense>
            {systemHealth?.services && Object.entries(systemHealth.services).map(([serviceName, service]) => (
              <ListItem key={serviceName}>
                <ListItemIcon>
                  {getStatusIcon(service.healthy, service.status)}
                </ListItemIcon>
                <ListItemText
                  primary={serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}
                  secondary={
                    <Box>
                      <Chip
                        label={getStatusLabel(service.healthy, service.status)}
                        size="small"
                        color={getStatusColor(service.healthy, service.status)}
                      />
                      {service.responseTime && (
                        <Typography variant="caption" display="block">
                          Response time: {service.responseTime}ms
                        </Typography>
                      )}
                      {service.error && (
                        <Typography variant="caption" color="error" display="block">
                          Error: {service.error}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
            
            {/* Overall system health */}
            <ListItem>
              <ListItemIcon>
                {getStatusIcon(systemHealth?.overall === 'healthy', systemHealth?.overall)}
              </ListItemIcon>
              <ListItemText
                primary="Overall System"
                secondary={
                  <Chip
                    label={systemHealth?.overall?.toUpperCase() || 'UNKNOWN'}
                    size="small"
                    color={getStatusColor(systemHealth?.overall === 'healthy', systemHealth?.overall)}
                  />
                }
              />
            </ListItem>
          </List>
        </Grid>
        
        <Grid item xs={12} md={6}>
          {performanceMetrics && (
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
                  {performanceMetrics.memoryUsageMB}MB
                </Typography>
              </Box>
              
              <Box mt={1}>
                <Typography variant="caption" color="text.secondary">
                  Uptime: {Math.floor(performanceMetrics.uptimeSeconds / 3600)}h {Math.floor((performanceMetrics.uptimeSeconds % 3600) / 60)}m
                </Typography>
              </Box>
            </Box>
          )}
          
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
                  <Typography variant="body2">
                    {alert.message}
                  </Typography>
                  {alert.timestamp && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
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