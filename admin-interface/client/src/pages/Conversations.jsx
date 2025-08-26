import React, { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Avatar,
  Chip,
  Grid,
  TextField,
  MenuItem,
} from '@mui/material'
import { Person, Chat, Facebook as FacebookIcon, Instagram as InstagramIcon } from '@mui/icons-material'
import DataTable from '../components/DataTable'
import { conversationsAPI } from '../services/api'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

function Conversations() {
  const [conversations, setConversations] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    fetchConversations()
  }, [page, rowsPerPage, dateFilter])

  const getDateRange = () => {
    const now = new Date()
    switch (dateFilter) {
      case 'today':
        return {
          startDate: startOfDay(now).toISOString(),
          endDate: endOfDay(now).toISOString(),
        }
      case 'week':
        return {
          startDate: startOfDay(subDays(now, 7)).toISOString(),
          endDate: endOfDay(now).toISOString(),
        }
      case 'month':
        return {
          startDate: startOfDay(subDays(now, 30)).toISOString(),
          endDate: endOfDay(now).toISOString(),
        }
      default:
        return {}
    }
  }

  const fetchConversations = async (search = '') => {
    try {
      setLoading(true)
      const dateRange = getDateRange()
      const response = await conversationsAPI.getAll({
        page: page + 1,
        limit: rowsPerPage,
        ...dateRange,
      })
      setConversations(response.data.conversations)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleSearch = async (query) => {
    if (!query) {
      fetchConversations()
      return
    }
    
    try {
      setLoading(true)
      const response = await conversationsAPI.search(query)
      setConversations(response.data.results)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error searching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (conversation) => {
    setSelectedConversation(conversation)
    setDialogOpen(true)
  }

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Export conversations to CSV')
  }

  const columns = [
    {
      field: 'user_name',
      headerName: 'User',
      minWidth: 200,
      render: (value, row) => (
        <Box display="flex" alignItems="center">
          <Avatar 
            src={row.profile_pic} 
            sx={{ mr: 1, width: 32, height: 32 }}
          >
            <Person />
          </Avatar>
          {value || 'Unknown User'}
        </Box>
      ),
    },
    {
      field: 'platform',
      headerName: 'Platform',
      minWidth: 100,
      render: (value) => (
        <Chip
          size="small"
          icon={value === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
          label={value === 'instagram' ? 'IG' : 'FB'}
          color={value === 'instagram' ? 'secondary' : 'primary'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'message',
      headerName: 'Message',
      minWidth: 300,
      render: (value) => (
        <Typography variant="body2" noWrap style={{ maxWidth: 300 }}>
          {value}
        </Typography>
      ),
    },
    {
      field: 'response',
      headerName: 'Response',
      minWidth: 300,
      render: (value) => (
        <Typography variant="body2" noWrap style={{ maxWidth: 300 }}>
          {value}
        </Typography>
      ),
    },
    {
      field: 'timestamp',
      headerName: 'Time',
      minWidth: 180,
      type: 'date',
    },
  ]

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Conversations
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          View and search all bot conversations
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            select
            label="Date Range"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value)
              setPage(0)
            }}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Time</MenuItem>
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="week">Last 7 Days</MenuItem>
            <MenuItem value="month">Last 30 Days</MenuItem>
          </TextField>
        </Box>

        <DataTable
          columns={columns}
          data={conversations}
          total={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          onRowClick={handleRowClick}
          searchable
          onSearch={handleSearch}
          exportable
          onExport={handleExport}
          loading={loading}
        />
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Chat sx={{ mr: 1 }} />
            <Typography variant="h6">Conversation Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Typography variant="subtitle2" gutterBottom>
                  User Information
                </Typography>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar 
                    src={selectedConversation?.profile_pic}
                    sx={{ mr: 2 }}
                  >
                    <Person />
                  </Avatar>
                  <Box>
                    <Typography variant="body1">
                      {selectedConversation?.user_name || 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      User ID: {selectedConversation?.user_id}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {selectedConversation?.timestamp ? 
                    format(new Date(selectedConversation.timestamp), 'PPpp') : '-'}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  User Message
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedConversation?.message}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="secondary">
                  Bot Response
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedConversation?.response}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Conversations