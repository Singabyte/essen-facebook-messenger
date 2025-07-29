import { useState, useEffect } from 'react'
import { analyticsAPI } from '../services/api'

export const useAnalytics = (dateRange = { startDate: null, endDate: null }) => {
  const [data, setData] = useState({
    overview: null,
    timeline: null,
    commands: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all analytics data in parallel
        const [overview, timeline, commands] = await Promise.all([
          analyticsAPI.getOverview(dateRange),
          analyticsAPI.getTimeline({ period: '7d' }),
          analyticsAPI.getCommands(),
        ])

        setData({
          overview: overview.data,
          timeline: timeline.data.timeline,
          commands: commands.data.commands,
        })
      } catch (err) {
        setError(err.message)
        console.error('Error fetching analytics:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [dateRange.startDate, dateRange.endDate])

  return { data, loading, error, refetch: () => fetchAnalytics() }
}