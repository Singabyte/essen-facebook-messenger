import React, { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Chip,
  Grid,
  Paper,
  Button,
} from '@mui/material'
import { Person, Message } from '@mui/icons-material'
import DataTable from '../components/DataTable'
import { usersAPI } from '../services/api'
import { format } from 'date-fns'

function Users() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    fetchUsers()
  }, [page, rowsPerPage])

  const fetchUsers = async (search = '') => {
    try {
      setLoading(true)
      const response = await usersAPI.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search,
      })
      setUsers(response.data.users)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserConversations = async (userId) => {
    try {
      const response = await usersAPI.getConversations(userId, { limit: 10 })
      setConversations(response.data.conversations)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleSearch = (query) => {
    setPage(0)
    fetchUsers(query)
  }

  const handleRowClick = async (user) => {
    setSelectedUser(user)
    setUserDialogOpen(true)
    await fetchUserConversations(user.id)
  }

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Export users to CSV')
  }

  const columns = [
    {
      field: 'id',
      headerName: 'User ID',
      minWidth: 150,
    },
    {
      field: 'name',
      headerName: 'Name',
      minWidth: 200,
      render: (value, row) => (
        <Box display="flex" alignItems="center">
          <Avatar src={row.profile_pic} sx={{ mr: 1, width: 32, height: 32 }}>
            <Person />
          </Avatar>
          {value || 'Unknown User'}
        </Box>
      ),
    },
    {
      field: 'created_at',
      headerName: 'First Seen',
      minWidth: 180,
      type: 'date',
    },
    {
      field: 'last_interaction',
      headerName: 'Last Active',
      minWidth: 180,
      type: 'date',
    },
  ]

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Users
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Manage and view all bot users
        </Typography>

        <DataTable
          columns={columns}
          data={users}
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
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Avatar src={selectedUser?.profile_pic} sx={{ mr: 2 }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="h6">
                {selectedUser?.name || 'Unknown User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {selectedUser?.id}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  User Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="First Seen"
                      secondary={selectedUser?.created_at ? 
                        format(new Date(selectedUser.created_at), 'PPpp') : '-'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Last Active"
                      secondary={selectedUser?.last_interaction ? 
                        format(new Date(selectedUser.last_interaction), 'PPpp') : '-'}
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Statistics
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Total Conversations"
                      secondary={conversations.length}
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2">
                    Recent Conversations
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<Message />}
                    onClick={() => {
                      setUserDialogOpen(false)
                      // Navigate to conversations with user filter
                    }}
                  >
                    View All
                  </Button>
                </Box>
                {conversations.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No conversations found
                  </Typography>
                ) : (
                  <List>
                    {conversations.map((conv) => (
                      <ListItem key={conv.id} divider>
                        <ListItemText
                          primary={conv.message}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                Response: {conv.response?.substring(0, 100)}...
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(conv.timestamp), 'PPp')}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </Container>
  )
}

export default Users