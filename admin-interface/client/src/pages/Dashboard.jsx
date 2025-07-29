import React, { useEffect, useState } from 'react'
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  People,
  Chat,
  EventNote,
  TrendingUp,
  Refresh,
} from '@mui/icons-material'
import StatCard from '../components/StatCard'
import ConversationChart from '../components/ConversationChart'
import CommandsChart from '../components/CommandsChart'
import LiveConversationFeed from '../components/LiveConversationFeed'
import SystemStatusMonitor from '../components/SystemStatusMonitor'
import { useAnalytics } from '../hooks/useAnalytics'
import { conversationsAPI } from '../services/api'
import { format } from 'date-fns'

function Dashboard() {
  const [conversationStats, setConversationStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  
  const { data: analytics, loading: analyticsLoading, refetch } = useAnalytics()

  useEffect(() => {
    fetchConversationStats()
  }, [])

  const fetchConversationStats = async () => {
    try {
      setStatsLoading(true)
      const response = await conversationsAPI.getStats()
      setConversationStats(response.data)
    } catch (error) {
      console.error('Error fetching conversation stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleRefresh = () => {
    refetch()
    fetchConversationStats()
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last updated: {format(new Date(), 'PPp')}
            </Typography>
          </Box>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={3}>
          {/* Stat Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={analytics?.overview?.totalUsers}
              icon={<People />}
              loading={analyticsLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Active Users"
              value={analytics?.overview?.activeUsers}
              previousValue={analytics?.overview?.totalUsers}
              icon={<TrendingUp />}
              loading={analyticsLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Today's Conversations"
              value={conversationStats?.todayConversations}
              icon={<Chat />}
              loading={statsLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Appointments"
              value={analytics?.overview?.totalAppointments}
              icon={<EventNote />}
              loading={analyticsLoading}
            />
          </Grid>

          {/* Charts */}
          <Grid item xs={12} md={8}>
            <ConversationChart 
              data={analytics?.timeline}
              loading={analyticsLoading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CommandsChart
              data={conversationStats?.popularCommands}
              loading={statsLoading}
            />
          </Grid>

          {/* Live Feed */}
          <Grid item xs={12} md={6}>
            <LiveConversationFeed />
          </Grid>

          {/* System Status */}
          <Grid item xs={12} md={6}>
            <SystemStatusMonitor />
          </Grid>
        </Grid>
      </Box>
    </Container>
  )
}

export default Dashboard