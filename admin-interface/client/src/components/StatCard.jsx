import React from 'react'
import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material'
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material'

function StatCard({ title, value, previousValue, icon, loading, format = 'number' }) {
  const formatValue = (val) => {
    if (format === 'number') {
      return val?.toLocaleString() || '0'
    }
    if (format === 'time') {
      // Convert seconds to readable format
      if (!val) return '0s'
      if (val < 60) return `${Math.round(val)}s`
      if (val < 3600) return `${Math.round(val / 60)}m`
      return `${Math.round(val / 3600)}h`
    }
    return val
  }

  const calculateTrend = () => {
    if (!previousValue || !value) return 0
    return ((value - previousValue) / previousValue) * 100
  }

  const trend = calculateTrend()
  
  const getTrendIcon = () => {
    if (trend > 5) return <TrendingUp color="success" />
    if (trend < -5) return <TrendingDown color="error" />
    return <TrendingFlat color="action" />
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {formatValue(value)}
                </Typography>
                {previousValue !== undefined && (
                  <Box display="flex" alignItems="center" mt={1}>
                    {getTrendIcon()}
                    <Typography
                      variant="body2"
                      color={trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary'}
                      ml={0.5}
                    >
                      {Math.abs(trend).toFixed(1)}%
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                backgroundColor: 'primary.light',
                borderRadius: 2,
                p: 1.5,
                color: 'primary.main',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default StatCard