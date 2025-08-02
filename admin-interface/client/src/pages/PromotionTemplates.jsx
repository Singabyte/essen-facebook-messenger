import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Alert,
  Snackbar,
  Fab,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as PreviewIcon,
  PlayArrow as TestIcon,
  Analytics as AnalyticsIcon,
  MoreVert as MoreIcon,
  Campaign as CampaignIcon,
  Image as ImageIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import api from '../services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function PromotionTemplates() {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuTemplate, setMenuTemplate] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    content: '',
    quick_replies: [],
    media_url: '',
    media_type: '',
    variables: [],
    trigger_keywords: [],
    is_active: true
  });

  const [testVariables, setTestVariables] = useState({});

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory, searchQuery]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await api.get(`/templates?${params.toString()}`);
      setTemplates(response.data.templates);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching templates:', error);
      showSnackbar('Error fetching templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      content: '',
      quick_replies: [],
      media_url: '',
      media_type: '',
      variables: [],
      trigger_keywords: [],
      is_active: true
    });
    setDialogOpen(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      content: template.content,
      quick_replies: JSON.parse(template.quick_replies || '[]'),
      media_url: template.media_url || '',
      media_type: template.media_type || '',
      variables: JSON.parse(template.variables || '[]'),
      trigger_keywords: JSON.parse(template.trigger_keywords || '[]'),
      is_active: Boolean(template.is_active)
    });
    setDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await api.put(`/templates/${editingTemplate.id}`, formData);
        showSnackbar('Template updated successfully');
      } else {
        await api.post('/templates', formData);
        showSnackbar('Template created successfully');
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      showSnackbar('Error saving template', 'error');
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      try {
        await api.delete(`/templates/${template.id}`);
        showSnackbar('Template deleted successfully');
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        showSnackbar('Error deleting template', 'error');
      }
    }
  };

  const handleDuplicateTemplate = async (template) => {
    try {
      await api.post(`/templates/${template.id}/duplicate`);
      showSnackbar('Template duplicated successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      showSnackbar('Error duplicating template', 'error');
    }
  };

  const handlePreviewTemplate = async (template) => {
    try {
      const response = await api.post(`/templates/${template.id}/test`, {
        variables: testVariables
      });
      setPreviewTemplate(response.data);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error previewing template:', error);
      showSnackbar('Error previewing template', 'error');
    }
  };

  const handleMenuOpen = (event, template) => {
    setMenuAnchor(event.currentTarget);
    setMenuTemplate(template);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuTemplate(null);
  };

  const addQuickReply = () => {
    setFormData({
      ...formData,
      quick_replies: [...formData.quick_replies, { title: '', payload: '' }]
    });
  };

  const updateQuickReply = (index, field, value) => {
    const newQuickReplies = [...formData.quick_replies];
    newQuickReplies[index][field] = value;
    setFormData({ ...formData, quick_replies: newQuickReplies });
  };

  const removeQuickReply = (index) => {
    const newQuickReplies = formData.quick_replies.filter((_, i) => i !== index);
    setFormData({ ...formData, quick_replies: newQuickReplies });
  };

  const addVariable = () => {
    setFormData({
      ...formData,
      variables: [...formData.variables, { name: '', description: '', default_value: '' }]
    });
  };

  const updateVariable = (index, field, value) => {
    const newVariables = [...formData.variables];
    newVariables[index][field] = value;
    setFormData({ ...formData, variables: newVariables });
  };

  const removeVariable = (index) => {
    const newVariables = formData.variables.filter((_, i) => i !== index);
    setFormData({ ...formData, variables: newVariables });
  };

  const addKeyword = (keyword) => {
    if (keyword && !formData.trigger_keywords.includes(keyword)) {
      setFormData({
        ...formData,
        trigger_keywords: [...formData.trigger_keywords, keyword]
      });
    }
  };

  const removeKeyword = (keyword) => {
    setFormData({
      ...formData,
      trigger_keywords: formData.trigger_keywords.filter(k => k !== keyword)
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Promotion Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTemplate}
        >
          Create Template
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search templates"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Templates Grid */}
      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="h2" noWrap>
                    {template.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, template)}
                  >
                    <MoreIcon />
                  </IconButton>
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {template.description}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip label={template.category} size="small" color="primary" />
                  {template.media_url && (
                    <Chip icon={<ImageIcon />} label="Media" size="small" />
                  )}
                  {!template.is_active && (
                    <Chip label="Inactive" size="small" color="error" />
                  )}
                </Box>
                
                <Typography variant="body2" sx={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {template.content}
                </Typography>
              </CardContent>
              
              <CardActions>
                <Button
                  size="small"
                  startIcon={<PreviewIcon />}
                  onClick={() => handlePreviewTemplate(template)}
                >
                  Preview
                </Button>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEditTemplate(template)}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Template Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Basic Info" />
            <Tab label="Content" />
            <Tab label="Quick Replies" />
            <Tab label="Variables" />
            <Tab label="Settings" />
          </Tabs>

          {/* Basic Info Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </TabPanel>

          {/* Content Tab */}
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Message Content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  multiline
                  rows={6}
                  required
                  helperText="Use {{variable_name}} for dynamic content"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Media URL"
                  value={formData.media_url}
                  onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Media Type</InputLabel>
                  <Select
                    value={formData.media_type}
                    onChange={(e) => setFormData({ ...formData, media_type: e.target.value })}
                    label="Media Type"
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="image">Image</MenuItem>
                    <MenuItem value="video">Video</MenuItem>
                    <MenuItem value="audio">Audio</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Quick Replies Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ mb: 2 }}>
              <Button onClick={addQuickReply} startIcon={<AddIcon />}>
                Add Quick Reply
              </Button>
            </Box>
            {formData.quick_replies.map((reply, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={5}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={reply.title}
                    onChange={(e) => updateQuickReply(index, 'title', e.target.value)}
                  />
                </Grid>
                <Grid item xs={5}>
                  <TextField
                    fullWidth
                    label="Payload"
                    value={reply.payload}
                    onChange={(e) => updateQuickReply(index, 'payload', e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton onClick={() => removeQuickReply(index)}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
          </TabPanel>

          {/* Variables Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ mb: 2 }}>
              <Button onClick={addVariable} startIcon={<AddIcon />}>
                Add Variable
              </Button>
            </Box>
            {formData.variables.map((variable, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={variable.name}
                    onChange={(e) => updateVariable(index, 'name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={variable.description}
                    onChange={(e) => updateVariable(index, 'description', e.target.value)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Default Value"
                    value={variable.default_value}
                    onChange={(e) => updateVariable(index, 'default_value', e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton onClick={() => removeVariable(index)}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
          </TabPanel>

          {/* Settings Tab */}
          <TabPanel value={tabValue} index={4}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6">Trigger Keywords</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {formData.trigger_keywords.map((keyword) => (
                    <Chip
                      key={keyword}
                      label={keyword}
                      onDelete={() => removeKeyword(keyword)}
                      size="small"
                    />
                  ))}
                </Box>
                <TextField
                  label="Add keyword"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addKeyword(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  helperText="Press Enter to add keyword"
                />
              </Grid>
            </Grid>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          {previewTemplate && (
            <Box>
              <Typography variant="h6" gutterBottom>Message Content:</Typography>
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
                <Typography>{previewTemplate.processed_content}</Typography>
              </Paper>
              
              {previewTemplate.media_url && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>Media:</Typography>
                  {previewTemplate.media_type === 'image' ? (
                    <img
                      src={previewTemplate.media_url}
                      alt="Template media"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  ) : (
                    <Box sx={{ p: 2, bgcolor: 'grey.100', textAlign: 'center' }}>
                      <Typography>{previewTemplate.media_type}: {previewTemplate.media_url}</Typography>
                    </Box>
                  )}
                </Box>
              )}
              
              {previewTemplate.quick_replies.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Quick Replies:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {previewTemplate.quick_replies.map((reply, index) => (
                      <Chip key={index} label={reply.title} variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleEditTemplate(menuTemplate); handleMenuClose(); }}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleDuplicateTemplate(menuTemplate); handleMenuClose(); }}>
          <ListItemIcon><CopyIcon /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handlePreviewTemplate(menuTemplate); handleMenuClose(); }}>
          <ListItemIcon><PreviewIcon /></ListItemIcon>
          <ListItemText>Preview</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleDeleteTemplate(menuTemplate); handleMenuClose(); }}>
          <ListItemIcon><DeleteIcon /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PromotionTemplates;