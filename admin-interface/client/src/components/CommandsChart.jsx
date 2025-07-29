import React from 'react'
import { Card, CardContent, Typography, Box } from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function CommandsChart({ data, loading }) {
  const formattedData = data?.map(item => ({
    command: item.message.replace('/', ''),
    count: item.count,
  })) || []

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Popular Commands
        </Typography>
        <Box sx={{ width: '100%', height: 300, mt: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <Typography color="text.secondary">Loading chart...</Typography>
            </Box>
          ) : formattedData.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <Typography color="text.secondary">No command data available</Typography>
            </Box>
          ) : (
            <ResponsiveContainer>
              <BarChart data={formattedData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="command" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1976d2" name="Usage Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default CommandsChart