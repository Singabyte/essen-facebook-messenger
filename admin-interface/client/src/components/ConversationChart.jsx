import React from 'react'
import { Card, CardContent, Typography, Box } from '@mui/material'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import { format, parseISO } from 'date-fns'

function ConversationChart({ data, loading }) {
  const formattedData = data?.map(item => ({
    ...item,
    date: format(parseISO(item.date), 'MMM dd'),
  })) || []

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Conversation Volume
        </Typography>
        <Box sx={{ width: '100%', height: 300, mt: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <Typography color="text.secondary">Loading chart...</Typography>
            </Box>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={formattedData}>
                <defs>
                  <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#1976d2"
                  fillOpacity={1}
                  fill="url(#colorConversations)"
                  name="Conversations"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default ConversationChart