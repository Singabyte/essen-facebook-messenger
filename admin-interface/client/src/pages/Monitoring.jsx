import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  TrendingUp,
  People,
  Speed,
  Message
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { useWebSocket } from '../hooks/useWebSocket';

// Simple metric card component
function MetricCard({ title, value, icon, color = 'primary', subtitle }) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4">
              {value || 0}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={`${color}.main`}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// Service status indicator
function ServiceStatus({ name, status }) {
  const getIcon = () => {
    if (status === 'running' || status === 'connected') return <CheckCircle color="success" />;
    if (status === 'degraded') return <Warning color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const getColor = () => {
    if (status === 'running' || status === 'connected') return 'success';
    if (status === 'degraded') return 'warning';
    return 'error';
  };

  return (
    <Box display="flex" alignItems="center" gap={1} mb={1}>
      {getIcon()}
      <Typography variant="body2">{name}</Typography>
      <Chip label={status} size="small" color={getColor()} />
    </Box>
  );
}

// Real-time message feed item
function MessageItem({ message }) {
  return (
    <ListItem divider>
      <ListItemText
        primary={
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" fontWeight="bold">
              {message.user_name || `User ${message.user_id}`}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {format(new Date(message.timestamp), 'HH:mm:ss')}
            </Typography>
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="textSecondary" noWrap>
              User: {message.message_text}
            </Typography>
            <Typography variant="body2" noWrap>
              Bot: {message.response_text}
            </Typography>
            <Typography variant="caption" color="primary">
              Response time: {message.response_time}ms
            </Typography>
          </Box>
        }
      />
    </ListItem>
  );
}

function Monitoring() {
  const [metrics, setMetrics] = useState({
    messages: { total: 0, last_hour: 0, last_24h: 0, avg_response_time: 0 },
    users: { total: 0, active_today: 0, active_this_week: 0 },
    system: { memory_mb: 0 }
  });
  const [health, setHealth] = useState({
    services: {
      bot: { status: 'unknown' },
      database: { status: 'unknown' },
      facebook: { status: 'unknown' },
      gemini: { status: 'unknown' }
    }
  });
  const [recentMessages, setRecentMessages] = useState([]);
  const [chartData, setChartData] = useState([]);

  const { on, off } = useWebSocket(['monitoring']);

  // Fetch initial data
  useEffect(() => {
    fetchMetrics();
    fetchHealth();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics();
      fetchHealth();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    const handleMetricsUpdate = (data) => {
      setMetrics(data);
      updateChartData(data);
    };

    const handleNewMessage = (message) => {
      setRecentMessages(prev => [message, ...prev].slice(0, 20));
    };

    const handleHealthChange = (data) => {
      setHealth(data);
    };

    on('metrics:update', handleMetricsUpdate);
    on('message:new', handleNewMessage);
    on('health:changed', handleHealthChange);

    return () => {
      off('metrics:update', handleMetricsUpdate);
      off('message:new', handleNewMessage);
      off('health:changed', handleHealthChange);
    };
  }, [on, off]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        updateChartData(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/monitoring/health-comprehensive', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch health:', error);
    }
  };

  const updateChartData = (metricsData) => {
    // Simple chart data - just show trend
    const now = new Date();
    setChartData(prev => {
      const newData = [...prev, {
        time: format(now, 'HH:mm'),
        messages: metricsData.messages.last_hour || 0,
        users: metricsData.users.active_today || 0
      }].slice(-20); // Keep last 20 data points
      return newData;
    });
  };

  const handleRefresh = () => {
    fetchMetrics();
    fetchHealth();
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            System Monitoring
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={3}>
          {/* Key Metrics */}
          <Grid item xs={12} md={3}>
            <MetricCard
              title="Total Messages"
              value={metrics.messages.total}
              subtitle={`${metrics.messages.last_hour} last hour`}
              icon={<Message />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricCard
              title="Active Users"
              value={metrics.users.active_today}
              subtitle={`${metrics.users.total} total`}
              icon={<People />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricCard
              title="Avg Response Time"
              value={`${metrics.messages.avg_response_time}ms`}
              icon={<Speed />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricCard
              title="Memory Usage"
              value={`${metrics.system.memory_mb}MB`}
              icon={<TrendingUp />}
              color="warning"
            />
          </Grid>

          {/* Service Health */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Service Health
              </Typography>
              <ServiceStatus name="Bot Service" status={health.services.bot?.status || 'unknown'} />
              <ServiceStatus name="Database" status={health.services.database?.status || 'unknown'} />
              <ServiceStatus name="Facebook API" status={health.services.facebook?.status || 'unknown'} />
              <ServiceStatus name="Gemini AI" status={health.services.gemini?.status || 'unknown'} />
            </Paper>
          </Grid>

          {/* Simple Chart */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Activity Trend
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="messages" stroke="#8884d8" name="Messages" />
                  <Line type="monotone" dataKey="users" stroke="#82ca9d" name="Active Users" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Real-time Message Feed */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Recent Messages
              </Typography>
              {recentMessages.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No recent messages
                </Typography>
              ) : (
                <List dense>
                  {recentMessages.map((msg, index) => (
                    <MessageItem key={index} message={msg} />
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default Monitoring;