import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Badge
} from '@mui/material'
import {
  Refresh,
  CheckCircle,
  Error,
  Warning,
  TrendingUp,
  TrendingDown,
  Speed,
  Memory,
  Storage,
  Api,
  Socket,
  Cache,
  People,
  Timeline,
  Security,
  MonitorHeart
} from '@mui/icons-material'
import { useWebSocket } from '../hooks/useWebSocket'
import { format } from 'date-fns'

// Real-time metrics chart component
const MetricsChart = ({ title, data, type = 'line', color = 'primary' }) => {
  return (
    <Card>
      <CardHeader 
        title={title}
        titleTypographyProps={{ variant: 'h6' }}
        sx={{ pb: 1 }}
      />
      <CardContent>
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Chart visualization would be implemented here with libraries like Chart.js or Recharts
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

// Service status indicator
const ServiceStatusIndicator = ({ service, status, details = {} }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': case 'connected': case 'operational':
        return 'success'
      case 'degraded': case 'warning':
        return 'warning'
      case 'unhealthy': case 'error': case 'disconnected':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': case 'connected': case 'operational':
        return <CheckCircle color="success" />
      case 'degraded': case 'warning':
        return <Warning color="warning" />
      case 'unhealthy': case 'error': case 'disconnected':
        return <Error color="error" />
      default:
        return <CheckCircle color="action" />
    }
  }

  return (
    <ListItem>
      <ListItemIcon>
        {getStatusIcon(status)}
      </ListItemIcon>
      <ListItemText
        primary={service}
        secondary={
          <Box>
            <Chip
              label={status?.toUpperCase() || 'UNKNOWN'}
              size="small"
              color={getStatusColor(status)}
              sx={{ mb: 0.5 }}
            />
            {details.responseTime && (
              <Typography variant="caption" display="block">
                Response time: {details.responseTime}ms
              </Typography>
            )}
            {details.error && (
              <Typography variant="caption" color="error" display="block">
                Error: {details.error}
              </Typography>
            )}
          </Box>
        }
      />
    </ListItem>
  )
}

// Performance metrics card
const PerformanceMetricsCard = ({ metrics }) => {
  const memoryUsagePercent = metrics.memory ? 
    (metrics.memory.rss / (metrics.memory.rss + 200)) * 100 : 0

  return (
    <Card>
      <CardHeader 
        title="Performance Metrics"
        avatar={<Avatar><Speed /></Avatar>}
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Memory Usage
            </Typography>
            <Box display="flex" alignItems="center" mb={2}>
              <Box flexGrow={1} mr={2}>
                <LinearProgress
                  variant="determinate"
                  value={memoryUsagePercent}
                  color={memoryUsagePercent > 80 ? 'error' : memoryUsagePercent > 60 ? 'warning' : 'primary'}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2">
                {metrics.memory?.rss || 0}MB
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Uptime
            </Typography>
            <Typography variant="h6">
              {metrics.uptime ? Math.floor(metrics.uptime / 3600) : 0}h
            </Typography>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Node Version
            </Typography>
            <Typography variant="h6">
              {metrics.nodeVersion || 'Unknown'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

// Real-time alerts component
const AlertsPanel = ({ alerts = [] }) => {
  return (
    <Card>
      <CardHeader 
        title="System Alerts"
        avatar={<Avatar><Security /></Avatar>}
      />
      <CardContent>
        {alerts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No active alerts
          </Typography>
        ) : (
          alerts.slice(0, 5).map((alert, index) => (
            <Alert
              key={index}
              severity={alert.severity || 'info'}
              sx={{ mb: 1 }}
            >
              <Typography variant="body2">
                {alert.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {format(new Date(alert.timestamp), 'HH:mm:ss')}
              </Typography>
            </Alert>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// Template cache metrics
const TemplateCacheMetrics = ({ cacheStats }) => {
  const hitRatio = cacheStats?.hitRatio || 0
  const size = cacheStats?.size || 0
  const requests = cacheStats?.totalRequests || 0

  return (
    <Card>
      <CardHeader 
        title="Template Cache"
        avatar={<Avatar><Cache /></Avatar>}
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary">
              Hit Ratio
            </Typography>
            <Typography variant="h6" color={hitRatio > 0.8 ? 'success.main' : 'warning.main'}>
              {Math.round(hitRatio * 100)}%
            </Typography>
          </Grid>
          
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary">
              Cache Size
            </Typography>
            <Typography variant="h6">
              {size}
            </Typography>
          </Grid>
          
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary">
              Requests
            </Typography>
            <Typography variant="h6">
              {requests}
            </Typography>
          </Grid>
        </Grid>
        
        <Box mt={2}>
          <LinearProgress
            variant="determinate"
            value={hitRatio * 100}
            color={hitRatio > 0.8 ? 'success' : 'warning'}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}

// Human intervention metrics
const HumanInterventionMetrics = ({ interventionStats }) => {
  const pendingCount = interventionStats?.pendingCount || 0
  const avgResponseTime = interventionStats?.avgResponseTime || 0
  const totalToday = interventionStats?.resolvedToday || 0

  return (
    <Card>
      <CardHeader 
        title="Human Intervention"
        avatar={
          <Badge badgeContent={pendingCount} color="error">
            <Avatar><People /></Avatar>
          </Badge>
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary">
              Pending
            </Typography>
            <Typography 
              variant="h6" 
              color={pendingCount > 5 ? 'error.main' : pendingCount > 2 ? 'warning.main' : 'success.main'}
            >
              {pendingCount}
            </Typography>
          </Grid>
          
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary">
              Avg Response
            </Typography>
            <Typography variant="h6">
              {Math.round(avgResponseTime / 1000 / 60)}m
            </Typography>
          </Grid>
          
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary">
              Resolved Today
            </Typography>
            <Typography variant="h6">
              {totalToday}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

// Main monitoring dashboard component
function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState(null)
  const [performanceMetrics, setPerformanceMetrics] = useState({})
  const [cacheStats, setCacheStats] = useState({})
  const [interventionStats, setInterventionStats] = useState({})
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  
  const { on, off } = useWebSocket(['monitoring'])

  useEffect(() => {
    fetchSystemHealth()
    fetchPerformanceMetrics()
    fetchCacheStats()
    fetchInterventionStats()
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchSystemHealth()
      fetchPerformanceMetrics()
      fetchCacheStats()
      fetchInterventionStats()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Handle real-time updates via WebSocket
    const handleSystemUpdate = (data) => {
      setSystemHealth(prev => ({ ...prev, ...data }))
      setLastUpdate(new Date())
    }

    const handlePerformanceUpdate = (data) => {
      setPerformanceMetrics(prev => ({ ...prev, ...data }))
      setLastUpdate(new Date())
    }

    const handleAlert = (alert) => {
      setAlerts(prev => [{ ...alert, timestamp: new Date() }, ...prev].slice(0, 10))
    }

    on('system:health', handleSystemUpdate)
    on('system:performance', handlePerformanceUpdate)
    on('system:alert', handleAlert)

    return () => {
      off('system:health', handleSystemUpdate)
      off('system:performance', handlePerformanceUpdate)
      off('system:alert', handleAlert)
    }
  }, [on, off])

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/monitoring/health-comprehensive')
      const data = await response.json()
      setSystemHealth(data)
    } catch (error) {
      console.error('Failed to fetch system health:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/system-stats')
      const data = await response.json()
      setPerformanceMetrics(data)
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error)
    }
  }

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/monitoring/template-cache-stats')
      const data = await response.json()
      setCacheStats(data)
    } catch (error) {
      console.error('Failed to fetch cache stats:', error)
    }
  }

  const fetchInterventionStats = async () => {
    try {
      const response = await fetch('/api/monitoring/human-intervention-stats')
      const data = await response.json()
      setInterventionStats(data)
    } catch (error) {
      console.error('Failed to fetch intervention stats:', error)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    fetchSystemHealth()
    fetchPerformanceMetrics()
    fetchCacheStats()
    fetchInterventionStats()
  }

  const getOverallHealthColor = (health) => {
    switch (health) {
      case 'healthy': return 'success'
      case 'degraded': return 'warning'
      case 'unhealthy': return 'error'
      default: return 'default'
    }
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              System Monitoring
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                Last updated: {format(lastUpdate, 'PPp')}
              </Typography>
              <Chip
                label={systemHealth?.overall?.toUpperCase() || 'UNKNOWN'}
                color={getOverallHealthColor(systemHealth?.overall)}
                size="small"
                icon={<MonitorHeart />}
              />
            </Box>
          </Box>
          <Tooltip title="Refresh all metrics">
            <IconButton onClick={handleRefresh} color="primary" disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={3}>
          {/* System Health Overview */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Service Health Status
              </Typography>
              <List dense>
                {systemHealth?.services && Object.entries(systemHealth.services).map(([service, health]) => (
                  <ServiceStatusIndicator
                    key={service}
                    service={service.charAt(0).toUpperCase() + service.slice(1)}
                    status={health.status}
                    details={health}
                  />
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Performance Metrics */}
          <Grid item xs={12} lg={6}>
            <PerformanceMetricsCard metrics={performanceMetrics} />
          </Grid>

          {/* Template Cache */}
          <Grid item xs={12} md={6} lg={4}>
            <TemplateCacheMetrics cacheStats={cacheStats} />
          </Grid>

          {/* Human Intervention */}
          <Grid item xs={12} md={6} lg={4}>
            <HumanInterventionMetrics interventionStats={interventionStats} />
          </Grid>

          {/* Alerts Panel */}
          <Grid item xs={12} md={12} lg={4}>
            <AlertsPanel alerts={alerts} />
          </Grid>

          {/* Response Time Chart */}
          <Grid item xs={12} md={6}>
            <MetricsChart 
              title="Response Time (ms)"
              data={[]}
              color="primary"
            />
          </Grid>

          {/* Request Rate Chart */}
          <Grid item xs={12} md={6}>
            <MetricsChart 
              title="Request Rate (req/min)"
              data={[]}
              color="secondary"
            />
          </Grid>

          {/* Error Rate Chart */}
          <Grid item xs={12} md={6}>
            <MetricsChart 
              title="Error Rate (%)"
              data={[]}
              color="error"
            />
          </Grid>

          {/* Memory Usage Chart */}
          <Grid item xs={12} md={6}>
            <MetricsChart 
              title="Memory Usage (MB)"
              data={[]}
              color="warning"
            />
          </Grid>
        </Grid>
      </Box>
    </Container>
  )
}

export default MonitoringDashboard