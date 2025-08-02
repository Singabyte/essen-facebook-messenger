import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Tabs,
  Tab,
  Chip,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  Chat,
  EventNote,
  Assessment,
  Download,
  Refresh,
  Schedule,
  Star,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { format, subDays } from 'date-fns';
import { analyticsAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function MetricCard({ title, value, change, icon, color = "primary" }) {
  const isPositive = change && parseFloat(change) > 0;
  
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="h2">
              {value || 0}
            </Typography>
            {change && (
              <Box display="flex" alignItems="center" mt={1}>
                {isPositive ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                <Typography 
                  variant="body2" 
                  color={isPositive ? "success.main" : "error.main"}
                  sx={{ ml: 0.5 }}
                >
                  {change}%
                </Typography>
              </Box>
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

function Analytics() {
  const [tabValue, setTabValue] = useState(0);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [realtimeData, setRealtimeData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [data, setData] = useState({
    overview: {},
    businessMetrics: [],
    userEngagement: [],
    conversionFunnel: {},
    productTrends: [],
    appointmentAnalytics: {},
    peakHours: [],
    satisfaction: {},
    performance: [],
    predictions: {},
    businessReport: {}
  });

  const { on, off } = useWebSocket(['analytics']);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  useEffect(() => {
    // Set up real-time event listeners
    const handleRealtimeUpdate = (updateData) => {
      setRealtimeData(prev => ({
        ...prev,
        ...updateData,
        lastUpdate: new Date().toISOString()
      }));
    };

    const handleMetricUpdate = (metricData) => {
      setData(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          ...metricData
        }
      }));
    };

    const handlePerformanceAlert = (alertData) => {
      setAlerts(prev => [...prev.slice(-4), {
        ...alertData,
        id: Date.now(),
        timestamp: new Date().toISOString()
      }]);
    };

    const handleSlowQuery = (queryData) => {
      setAlerts(prev => [...prev.slice(-4), {
        type: 'slow_query',
        message: `Slow query detected: ${queryData.execution_time}ms`,
        severity: 'warning',
        id: Date.now(),
        timestamp: new Date().toISOString()
      }]);
    };

    const handleBusinessMetricsUpdate = (metrics) => {
      setData(prev => ({
        ...prev,
        businessMetrics: [metrics, ...prev.businessMetrics.slice(0, 29)]
      }));
    };

    const handleAppointmentUpdate = (appointmentData) => {
      // Update appointment count in real-time
      setData(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          totalAppointments: (prev.overview.totalAppointments || 0) + 1
        }
      }));
    };

    // Subscribe to real-time events
    on('analytics:realtime:update', handleRealtimeUpdate);
    on('metric:update', handleMetricUpdate);
    on('performance:alert', handlePerformanceAlert);
    on('slow-query:detected', handleSlowQuery);
    on('business-metrics:update', handleBusinessMetricsUpdate);
    on('appointment:analytics:update', handleAppointmentUpdate);

    return () => {
      // Cleanup event listeners
      off('analytics:realtime:update', handleRealtimeUpdate);
      off('metric:update', handleMetricUpdate);
      off('performance:alert', handlePerformanceAlert);
      off('slow-query:detected', handleSlowQuery);
      off('business-metrics:update', handleBusinessMetricsUpdate);
      off('appointment:analytics:update', handleAppointmentUpdate);
    };
  }, [on, off]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [
        overview,
        businessMetrics,
        userEngagement,
        conversionFunnel,
        productTrends,
        appointmentAnalytics,
        peakHours,
        satisfaction,
        performance,
        predictions,
        businessReport
      ] = await Promise.all([
        analyticsAPI.getOverview({ days: period }),
        analyticsAPI.getBusinessMetrics(period),
        analyticsAPI.getUserEngagement(),
        analyticsAPI.getConversionFunnel(),
        analyticsAPI.getProductTrends(period),
        analyticsAPI.getAppointmentAnalytics(period),
        analyticsAPI.getPeakHours(period),
        analyticsAPI.getSatisfaction(period),
        analyticsAPI.getPerformance(),
        analyticsAPI.getPredictions(),
        analyticsAPI.getBusinessReport(period)
      ]);

      setData({
        overview: overview.data,
        businessMetrics: businessMetrics.data.metrics || [],
        userEngagement: userEngagement.data.users || [],
        conversionFunnel: conversionFunnel.data,
        productTrends: productTrends.data.trends || [],
        appointmentAnalytics: appointmentAnalytics.data,
        peakHours: peakHours.data.hours || [],
        satisfaction: satisfaction.data,
        performance: performance.data.metrics || [],
        predictions: predictions.data,
        businessReport: businessReport.data
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type, format = 'csv') => {
    try {
      const response = await analyticsAPI.exportData(type, format);
      // Handle download based on format
      if (format === 'csv') {
        // CSV download is handled by the server
        window.open(`/api/analytics/export?type=${type}&format=${format}`, '_blank');
      } else {
        // JSON download
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const formatConversionFunnelData = () => {
    const funnel = data.conversionFunnel;
    return [
      { name: 'Total Users', value: funnel.total_users || 0, fill: COLORS[0] },
      { name: 'Showed Interest', value: funnel.interested_users || 0, fill: COLORS[1] },
      { name: 'Requested Consultation', value: funnel.consultation_requests || 0, fill: COLORS[2] },
      { name: 'Booked Appointment', value: funnel.appointments_booked || 0, fill: COLORS[3] }
    ];
  };

  const formatBusinessMetricsChart = () => {
    return data.businessMetrics.slice(0, 30).reverse().map(metric => ({
      date: format(new Date(metric.metric_date), 'MMM dd'),
      conversations: metric.total_conversations,
      users: metric.unique_users,
      appointments: metric.appointments_booked,
      conversionRate: metric.conversion_rate
    }));
  };

  const formatProductTrendsChart = () => {
    return data.productTrends.map(product => ({
      name: product.product_category,
      mentions: product.total_mentions,
      avgDaily: product.avg_daily_mentions,
      fill: COLORS[data.productTrends.indexOf(product) % COLORS.length]
    }));
  };

  const formatPeakHoursChart = () => {
    return data.peakHours.map(hour => ({
      hour: `${hour.hour}:00`,
      messages: hour.message_count,
      users: hour.unique_users
    }));
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Business Analytics
          </Typography>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={period}
                label="Period"
                onChange={(e) => setPeriod(e.target.value)}
              >
                <MenuItem value="7">7 Days</MenuItem>
                <MenuItem value="30">30 Days</MenuItem>
                <MenuItem value="90">90 Days</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchAnalyticsData} color="primary">
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExport('overview', 'json')}
            >
              Export Report
            </Button>
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Real-time Alerts */}
        {alerts.length > 0 && (
          <Box mb={3}>
            {alerts.slice(-3).map((alert) => (
              <Alert 
                key={alert.id} 
                severity={alert.severity || 'info'} 
                sx={{ mb: 1 }}
                onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
              >
                {alert.message} - {format(new Date(alert.timestamp), 'HH:mm:ss')}
              </Alert>
            ))}
          </Box>
        )}

        {/* Real-time Data Indicator */}
        {realtimeData.lastUpdate && (
          <Box display="flex" alignItems="center" mb={2}>
            <Box 
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                backgroundColor: 'success.main',
                mr: 1,
                animation: 'pulse 2s infinite'
              }} 
            />
            <Typography variant="body2" color="textSecondary">
              Live data - Last updated: {format(new Date(realtimeData.lastUpdate), 'HH:mm:ss')}
            </Typography>
          </Box>
        )}

        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
          <Tab label="Overview" />
          <Tab label="Customer Analytics" />
          <Tab label="Product Insights" />
          <Tab label="Performance" />
          <Tab label="Predictions" />
          <Tab label="Reports" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Users"
                value={data.overview.totalUsers}
                icon={<People />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Active Users"
                value={data.overview.activeUsers}
                icon={<TrendingUp />}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Conversations"
                value={data.overview.totalConversations}
                icon={<Chat />}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Appointments"
                value={data.overview.totalAppointments}
                icon={<EventNote />}
                color="warning"
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Daily Activity Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={formatBusinessMetricsChart()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="conversations" 
                      stroke={COLORS[0]} 
                      name="Conversations"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke={COLORS[1]} 
                      name="Unique Users"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="appointments" 
                      stroke={COLORS[2]} 
                      name="Appointments"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Conversion Funnel
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart layout="horizontal" data={formatConversionFunnelData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
                <Box mt={2}>
                  <Typography variant="body2" color="textSecondary">
                    Conversion Rates:
                  </Typography>
                  <Typography variant="body2">
                    Interest: {data.conversionFunnel.interest_rate || 0}%
                  </Typography>
                  <Typography variant="body2">
                    Consultation: {data.conversionFunnel.consultation_rate || 0}%
                  </Typography>
                  <Typography variant="body2">
                    Booking: {data.conversionFunnel.booking_rate || 0}%
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Customer Analytics Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">User Satisfaction</Typography>
                  <Chip 
                    label={`${data.satisfaction.satisfaction_rate || 0}%`} 
                    color={data.satisfaction.satisfaction_rate > 70 ? "success" : "warning"}
                  />
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Users
                    </Typography>
                    <Typography variant="h5">
                      {data.satisfaction.total_users || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Positive Feedback
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {data.satisfaction.positive_users || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Converted Users
                    </Typography>
                    <Typography variant="h5" color="primary.main">
                      {data.satisfaction.converted_users || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Avg Messages/User
                    </Typography>
                    <Typography variant="h5">
                      {Math.round(data.satisfaction.avg_messages_per_user || 0)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Peak Usage Hours
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={formatPeakHoursChart()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="messages" 
                      stroke={COLORS[0]} 
                      fill={COLORS[0]}
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Top Engaged Users</Typography>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleExport('user_engagement')}
                  >
                    Export
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell align="right">Conversations</TableCell>
                        <TableCell align="right">Appointments</TableCell>
                        <TableCell align="right">Engagement Hours</TableCell>
                        <TableCell>Commands Used</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.userEngagement.slice(0, 10).map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.name || 'Unknown User'}</TableCell>
                          <TableCell align="right">{user.total_conversations}</TableCell>
                          <TableCell align="right">{user.total_appointments}</TableCell>
                          <TableCell align="right">
                            {Math.round(user.engagement_hours || 0)}h
                          </TableCell>
                          <TableCell>
                            {user.commands_used?.slice(0, 3).join(', ') || 'None'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Product Insights Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Product Inquiry Trends</Typography>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleExport('product_trends')}
                  >
                    Export
                  </Button>
                </Box>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={formatProductTrendsChart()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="mentions" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Top Products
                </Typography>
                <List>
                  {data.productTrends.slice(0, 5).map((product, index) => (
                    <ListItem key={product.product_category}>
                      <ListItemText
                        primary={product.product_category}
                        secondary={`${product.total_mentions} mentions (${Math.round(product.avg_daily_mentions)} avg/day)`}
                      />
                      <Chip 
                        size="small" 
                        label={`#${index + 1}`}
                        color={index === 0 ? "primary" : "default"}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>

              <Paper sx={{ p: 3, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Appointment Analytics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Total Bookings
                    </Typography>
                    <Typography variant="h4">
                      {data.appointmentAnalytics.total_appointments || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Conversion Rate
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {data.appointmentAnalytics.conversion_stats?.conversion_rate || 0}%
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Database Performance
                </Typography>
                <List>
                  {data.performance.map((metric) => (
                    <ListItem key={metric.metric_name}>
                      <ListItemText
                        primary={metric.metric_name}
                        secondary={`Avg: ${metric.avg_value?.toFixed(2)}, Max: ${metric.max_value?.toFixed(2)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  System Health
                </Typography>
                <Box display="flex" alignItems="center" mb={2}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  <Typography>Database Connection: Healthy</Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={2}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  <Typography>API Response Time: Good</Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={2}>
                  <Warning color="warning" sx={{ mr: 1 }} />
                  <Typography>Query Performance: Monitor</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Predictions Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Appointment Forecasting
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Predicted Appointments (Next 7 Days)
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {data.predictions.appointments?.predicted_appointments || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Pessimistic
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {data.predictions.appointments?.pessimistic_forecast || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Optimistic
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {data.predictions.appointments?.optimistic_forecast || 0}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Customer Segments
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.predictions.customer_segments || []}
                      dataKey="user_count"
                      nameKey="value_segment"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                    >
                      {(data.predictions.customer_segments || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Reports Tab */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Typography variant="h6">
                    Business Intelligence Report
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={() => handleExport('business-report', 'json')}
                  >
                    Download Full Report
                  </Button>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Executive Summary
                    </Typography>
                    <Box mb={2}>
                      <Typography variant="body2" color="textSecondary">
                        Total Users: {data.businessReport.executive_summary?.total_users || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Active Users: {data.businessReport.executive_summary?.active_users || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Conversion Rate: {data.businessReport.executive_summary?.conversion_rate || 0}%
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Satisfaction Rate: {data.businessReport.executive_summary?.satisfaction_rate || 0}%
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Key Recommendations
                    </Typography>
                    <List>
                      {(data.businessReport.recommendations || []).map((rec, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={rec.recommendation}
                            secondary={`${rec.category} - ${rec.priority} Priority`}
                          />
                          <Chip 
                            size="small" 
                            label={rec.priority}
                            color={rec.priority === 'High' ? 'error' : rec.priority === 'Medium' ? 'warning' : 'info'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Container>
  );
}

export default Analytics;