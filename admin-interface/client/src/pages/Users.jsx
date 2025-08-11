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
  IconButton,
  Drawer,
  Switch,
  Tooltip,
} from '@mui/material'
import { 
  Person, 
  Message, 
  Chat as ChatIcon,
  SmartToy as BotIcon,
  Close as CloseIcon 
} from '@mui/icons-material'
import DataTable from '../components/DataTable'
import MessengerChat from '../components/MessengerChat'
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
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)
  const [chatUser, setChatUser] = useState(null)

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

  const handleOpenChat = (user) => {
    setChatUser(user);
    setChatDrawerOpen(true);
  };

  const handleCloseChat = () => {
    setChatDrawerOpen(false);
    setTimeout(() => setChatUser(null), 300); // Clear user after drawer animation
  };

  const handleToggleBotStatus = async (user, event) => {
    event.stopPropagation();
    try {
      const newStatus = !user.bot_enabled;
      await usersAPI.toggleBotStatus(user.id, newStatus);
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, bot_enabled: newStatus } : u
      ));
    } catch (error) {
      console.error('Error toggling bot status:', error);
    }
  };

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
    {
      field: 'bot_enabled',
      headerName: 'Bot Status',
      minWidth: 120,
      render: (value, row) => (
        <Tooltip title={value !== false ? 'Bot is responding' : 'Admin takeover active'}>
          <Switch
            checked={value !== false}
            onClick={(e) => handleToggleBotStatus(row, e)}
            color="primary"
            size="small"
          />
        </Tooltip>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 120,
      sortable: false,
      render: (value, row) => (
        <Box>
          <Tooltip title="Open Chat">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenChat(row);
              }}
            >
              <ChatIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
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

      {/* Messenger Chat Drawer */}
      <Drawer
        anchor="right"
        open={chatDrawerOpen}
        onClose={handleCloseChat}
        PaperProps={{
          sx: { 
            width: { xs: '100%', sm: 600, md: 700 },
            p: 0
          }
        }}
      >
        <Box sx={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative'
        }}>
          <Box sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            zIndex: 1 
          }}>
            <IconButton onClick={handleCloseChat}>
              <CloseIcon />
            </IconButton>
          </Box>
          {chatUser && (
            <MessengerChat 
              user={chatUser} 
              onClose={handleCloseChat}
            />
          )}
        </Box>
      </Drawer>
    </Container>
  )
}

export default Users