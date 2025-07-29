import React, { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
} from '@mui/material'
import {
  Save,
  Add,
  Delete,
  Edit,
  Webhook,
  Message,
  Schedule,
  Security,
} from '@mui/icons-material'

// Tab panels
function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

function Settings() {
  const [activeTab, setActiveTab] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  
  // Configuration states
  const [generalConfig, setGeneralConfig] = useState({
    botName: 'ESSEN Bot',
    welcomeMessage: 'Hello! Welcome to ESSEN Furniture. How can I help you today?',
    defaultLanguage: 'en',
    responseDelay: 1000,
    typingIndicator: true,
    maintenanceMode: false,
  })

  const [webhookConfig, setWebhookConfig] = useState({
    verifyToken: '',
    appSecret: '',
    pageAccessToken: '',
    webhookUrl: '',
  })

  const [quickReplies, setQuickReplies] = useState([
    { id: 1, text: 'View Products', payload: '/products' },
    { id: 2, text: 'Book Consultation', payload: '/consultation' },
    { id: 3, text: 'Showroom Info', payload: '/showroom' },
  ])

  const [autoResponses, setAutoResponses] = useState([
    { id: 1, trigger: 'hello', response: 'Hello! How can I help you today?', active: true },
    { id: 2, trigger: 'thanks', response: "You're welcome! Is there anything else I can help with?", active: true },
  ])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [dialogType, setDialogType] = useState('')

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }

  const handleSaveGeneral = () => {
    // TODO: Save to API
    showSnackbar('General settings saved successfully')
  }

  const handleSaveWebhook = () => {
    // TODO: Save to API
    showSnackbar('Webhook configuration saved successfully')
  }

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  const handleAddQuickReply = () => {
    setEditingItem({ text: '', payload: '' })
    setDialogType('quickReply')
    setDialogOpen(true)
  }

  const handleEditQuickReply = (item) => {
    setEditingItem(item)
    setDialogType('quickReply')
    setDialogOpen(true)
  }

  const handleDeleteQuickReply = (id) => {
    setQuickReplies(quickReplies.filter(item => item.id !== id))
    showSnackbar('Quick reply deleted')
  }

  const handleAddAutoResponse = () => {
    setEditingItem({ trigger: '', response: '', active: true })
    setDialogType('autoResponse')
    setDialogOpen(true)
  }

  const handleEditAutoResponse = (item) => {
    setEditingItem(item)
    setDialogType('autoResponse')
    setDialogOpen(true)
  }

  const handleDeleteAutoResponse = (id) => {
    setAutoResponses(autoResponses.filter(item => item.id !== id))
    showSnackbar('Auto response deleted')
  }

  const handleToggleAutoResponse = (id) => {
    setAutoResponses(autoResponses.map(item => 
      item.id === id ? { ...item, active: !item.active } : item
    ))
  }

  const handleDialogSave = () => {
    if (dialogType === 'quickReply') {
      if (editingItem.id) {
        setQuickReplies(quickReplies.map(item => 
          item.id === editingItem.id ? editingItem : item
        ))
      } else {
        setQuickReplies([...quickReplies, { ...editingItem, id: Date.now() }])
      }
      showSnackbar('Quick reply saved')
    } else if (dialogType === 'autoResponse') {
      if (editingItem.id) {
        setAutoResponses(autoResponses.map(item => 
          item.id === editingItem.id ? editingItem : item
        ))
      } else {
        setAutoResponses([...autoResponses, { ...editingItem, id: Date.now() }])
      }
      showSnackbar('Auto response saved')
    }
    setDialogOpen(false)
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Bot Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure bot settings and automated responses
        </Typography>

        <Paper sx={{ mt: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="General" icon={<Message />} iconPosition="start" />
            <Tab label="Webhooks" icon={<Webhook />} iconPosition="start" />
            <Tab label="Quick Replies" icon={<Schedule />} iconPosition="start" />
            <Tab label="Auto Responses" icon={<Message />} iconPosition="start" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            <TabPanel value={activeTab} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Bot Name"
                    value={generalConfig.botName}
                    onChange={(e) => setGeneralConfig({ ...generalConfig, botName: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Response Delay (ms)"
                    type="number"
                    value={generalConfig.responseDelay}
                    onChange={(e) => setGeneralConfig({ ...generalConfig, responseDelay: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Welcome Message"
                    value={generalConfig.welcomeMessage}
                    onChange={(e) => setGeneralConfig({ ...generalConfig, welcomeMessage: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={generalConfig.typingIndicator}
                        onChange={(e) => setGeneralConfig({ ...generalConfig, typingIndicator: e.target.checked })}
                      />
                    }
                    label="Show typing indicator"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={generalConfig.maintenanceMode}
                        onChange={(e) => setGeneralConfig({ ...generalConfig, maintenanceMode: e.target.checked })}
                        color="warning"
                      />
                    }
                    label="Maintenance Mode"
                  />
                  {generalConfig.maintenanceMode && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Bot will respond with maintenance message to all users
                    </Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveGeneral}
                  >
                    Save General Settings
                  </Button>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    These values are set in environment variables. Changes here will update the .env file.
                  </Alert>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Verify Token"
                    value={webhookConfig.verifyToken}
                    onChange={(e) => setWebhookConfig({ ...webhookConfig, verifyToken: e.target.value })}
                    type="password"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="App Secret"
                    value={webhookConfig.appSecret}
                    onChange={(e) => setWebhookConfig({ ...webhookConfig, appSecret: e.target.value })}
                    type="password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Page Access Token"
                    value={webhookConfig.pageAccessToken}
                    onChange={(e) => setWebhookConfig({ ...webhookConfig, pageAccessToken: e.target.value })}
                    type="password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Webhook URL"
                    value={webhookConfig.webhookUrl}
                    onChange={(e) => setWebhookConfig({ ...webhookConfig, webhookUrl: e.target.value })}
                    helperText="Your server's webhook endpoint"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveWebhook}
                  >
                    Save Webhook Configuration
                  </Button>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Quick Replies</Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddQuickReply}
                >
                  Add Quick Reply
                </Button>
              </Box>
              <List>
                {quickReplies.map((reply) => (
                  <React.Fragment key={reply.id}>
                    <ListItem>
                      <ListItemText
                        primary={reply.text}
                        secondary={`Payload: ${reply.payload}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleEditQuickReply(reply)}>
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteQuickReply(reply.id)}>
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Automated Responses</Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddAutoResponse}
                >
                  Add Auto Response
                </Button>
              </Box>
              <List>
                {autoResponses.map((response) => (
                  <React.Fragment key={response.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center">
                            <Typography variant="body1">
                              Trigger: "{response.trigger}"
                            </Typography>
                            <Chip
                              label={response.active ? 'Active' : 'Inactive'}
                              color={response.active ? 'success' : 'default'}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          </Box>
                        }
                        secondary={`Response: ${response.response}`}
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={response.active}
                          onChange={() => handleToggleAutoResponse(response.id)}
                        />
                        <IconButton onClick={() => handleEditAutoResponse(response)}>
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteAutoResponse(response.id)}>
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </TabPanel>
          </Box>
        </Paper>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {dialogType === 'quickReply' ? 
              (editingItem?.id ? 'Edit Quick Reply' : 'Add Quick Reply') :
              (editingItem?.id ? 'Edit Auto Response' : 'Add Auto Response')
            }
          </DialogTitle>
          <DialogContent>
            {dialogType === 'quickReply' ? (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Button Text"
                    value={editingItem?.text || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Payload/Command"
                    value={editingItem?.payload || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, payload: e.target.value })}
                    helperText="e.g., /products, /help"
                  />
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Trigger Word/Phrase"
                    value={editingItem?.trigger || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, trigger: e.target.value })}
                    helperText="Text that will trigger this response"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Response"
                    value={editingItem?.response || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, response: e.target.value })}
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDialogSave} variant="contained">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  )
}

export default Settings