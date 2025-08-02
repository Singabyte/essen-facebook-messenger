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
  Paper,
  Alert,
  Snackbar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Badge,
  Menu,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
  Analytics as AnalyticsIcon,
  HelpOutline as HelpIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  MoreVert as MoreIcon,
  FileCopy as CopyIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { api } from '../services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`faq-tabpanel-${index}`}
      aria-labelledby={`faq-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function FAQs() {
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [tabValue, setTabValue] = useState(0);
  const [popularFaqs, setPopularFaqs] = useState([]);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuFaq, setMenuFaq] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '',
    keywords: [],
    sort_order: 0,
    is_active: true
  });

  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    fetchFaqs();
    fetchPopularFaqs();
  }, [selectedCategory, searchQuery]);

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await api.get(`/faqs?${params.toString()}`);
      setFaqs(response.data.faqs);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      showSnackbar('Error fetching FAQs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularFaqs = async () => {
    try {
      const response = await api.get('/faqs/analytics/popular?days=30&limit=10');
      setPopularFaqs(response.data.popular_faqs);
    } catch (error) {
      console.error('Error fetching popular FAQs:', error);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateFaq = () => {
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: '',
      category: '',
      keywords: [],
      sort_order: 0,
      is_active: true
    });
    setDialogOpen(true);
  };

  const handleEditFaq = (faq) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '',
      keywords: Array.isArray(faq.keywords) ? faq.keywords : JSON.parse(faq.keywords || '[]'),
      sort_order: faq.sort_order || 0,
      is_active: Boolean(faq.is_active)
    });
    setDialogOpen(true);
  };

  const handleSaveFaq = async () => {
    try {
      if (editingFaq) {
        await api.put(`/faqs/${editingFaq.id}`, formData);
        showSnackbar('FAQ updated successfully');
      } else {
        await api.post('/faqs', formData);
        showSnackbar('FAQ created successfully');
      }
      setDialogOpen(false);
      fetchFaqs();
      fetchPopularFaqs();
    } catch (error) {
      console.error('Error saving FAQ:', error);
      showSnackbar('Error saving FAQ', 'error');
    }
  };

  const handleDeleteFaq = async (faq) => {
    if (window.confirm(`Are you sure you want to delete "${faq.question}"?`)) {
      try {
        await api.delete(`/faqs/${faq.id}`);
        showSnackbar('FAQ deleted successfully');
        fetchFaqs();
        fetchPopularFaqs();
      } catch (error) {
        console.error('Error deleting FAQ:', error);
        showSnackbar('Error deleting FAQ', 'error');
      }
    }
  };

  const handleSearchFaqs = async (query) => {
    try {
      const response = await api.post('/faqs/search', { query, limit: 10 });
      return response.data.results;
    } catch (error) {
      console.error('Error searching FAQs:', error);
      return [];
    }
  };

  const handleReorderFaqs = async (reorderedFaqs) => {
    try {
      await api.put('/faqs/reorder', { faqs: reorderedFaqs });
      showSnackbar('FAQ order updated successfully');
      fetchFaqs();
    } catch (error) {
      console.error('Error reordering FAQs:', error);
      showSnackbar('Error reordering FAQs', 'error');
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword)
    });
  };

  const handleMenuOpen = (event, faq) => {
    setMenuAnchor(event.currentTarget);
    setMenuFaq(faq);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuFaq(null);
  };

  const groupedFaqs = faqs.reduce((acc, faq) => {
    const category = faq.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(faq);
    return acc;
  }, {});

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          FAQ Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateFaq}
        >
          Create FAQ
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="All FAQs" icon={<HelpIcon />} />
          <Tab 
            label="Popular FAQs" 
            icon={
              <Badge badgeContent={popularFaqs.length} color="primary">
                <TrendingUpIcon />
              </Badge>
            } 
          />
          <Tab label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>
      </Paper>

      {/* All FAQs Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search FAQs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
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

        {/* FAQs by Category */}
        {Object.keys(groupedFaqs).map((category) => (
          <Accordion key={category} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CategoryIcon />
                <Typography variant="h6">{category}</Typography>
                <Chip label={groupedFaqs[category].length} size="small" color="primary" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {groupedFaqs[category].map((faq) => (
                  <Card key={faq.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
                          {faq.question}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {!faq.is_active && (
                            <Chip label="Inactive" size="small" color="error" />
                          )}
                          {faq.usage_count > 0 && (
                            <Chip 
                              label={`${faq.usage_count} uses`} 
                              size="small" 
                              color="info"
                              icon={<AnalyticsIcon />}
                            />
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, faq)}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      <Typography variant="body1" paragraph>
                        {faq.answer}
                      </Typography>
                      
                      {Array.isArray(faq.keywords) && faq.keywords.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                            Keywords:
                          </Typography>
                          {faq.keywords.map((keyword, index) => (
                            <Chip key={index} label={keyword} size="small" variant="outlined" />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                    
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditFaq(faq)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        color="error"
                        onClick={() => handleDeleteFaq(faq)}
                      >
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </TabPanel>

      {/* Popular FAQs Tab */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>
          Most Asked Questions (Last 30 Days)
        </Typography>
        <Grid container spacing={2}>
          {popularFaqs.map((faq, index) => (
            <Grid item xs={12} md={6} key={faq.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" color="primary">
                      #{index + 1}
                    </Typography>
                    <Chip 
                      label={`${faq.usage_count || 0} times`} 
                      size="small" 
                      color="success"
                      sx={{ ml: 2 }}
                    />
                  </Box>
                  <Typography variant="subtitle1" gutterBottom>
                    {faq.question}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {faq.answer.substring(0, 150)}...
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => handleEditFaq(faq)}>
                    Edit
                  </Button>
                  <Button size="small" startIcon={<ViewIcon />}>
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total FAQs
                </Typography>
                <Typography variant="h4">
                  {faqs.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Active FAQs
                </Typography>
                <Typography variant="h4">
                  {faqs.filter(faq => faq.is_active).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Categories
                </Typography>
                <Typography variant="h4">
                  {categories.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* FAQ Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingFaq ? 'Edit FAQ' : 'Create FAQ'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                required
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Answer"
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                required
                multiline
                rows={4}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Sort Order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Keywords
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {formData.keywords.map((keyword) => (
                  <Chip
                    key={keyword}
                    label={keyword}
                    onDelete={() => removeKeyword(keyword)}
                    size="small"
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                label="Add keyword"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                helperText="Press Enter to add keyword"
              />
            </Grid>
            <Grid item xs={12}>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveFaq} variant="contained">
            {editingFaq ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleEditFaq(menuFaq); handleMenuClose(); }}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleDeleteFaq(menuFaq); handleMenuClose(); }}>
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

export default FAQs;