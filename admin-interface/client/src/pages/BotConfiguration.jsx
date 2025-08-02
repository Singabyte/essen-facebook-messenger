import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  Snackbar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Slider,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  RestoreFromTrash as ResetIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Tune as TuneIcon,
  Psychology as PsychologyIcon,
  Timer as TimerIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import api from '../services/api';

function BotConfiguration() {
  const [configs, setConfigs] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newConfigData, setNewConfigData] = useState({
    key_name: '',
    value: '',
    data_type: 'string',
    category: 'general',
    description: '',
    is_public: false
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/bot-config');
      setConfigs(response.data.configs);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching bot config:', error);
      showSnackbar('Error fetching bot configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleUpdateConfig = async (key, value, description) => {
    try {
      setSaving(true);
      await api.put(`/bot-config/${key}`, { value, description });
      showSnackbar('Configuration updated successfully');
      fetchConfigs();
    } catch (error) {
      console.error('Error updating config:', error);
      showSnackbar('Error updating configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async (updates) => {
    try {
      setSaving(true);
      await api.put('/bot-config', { configs: updates });
      showSnackbar('Configurations updated successfully');
      fetchConfigs();
    } catch (error) {
      console.error('Error updating configs:', error);
      showSnackbar('Error updating configurations', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetConfig = async (key) => {
    if (window.confirm('Are you sure you want to reset this configuration to its default value?')) {
      try {
        await api.post(`/bot-config/${key}/reset`);
        showSnackbar('Configuration reset successfully');
        fetchConfigs();
      } catch (error) {
        console.error('Error resetting config:', error);
        showSnackbar('Error resetting configuration', 'error');
      }
    }
  };

  const handleCreateConfig = async () => {
    try {
      await api.post('/bot-config', newConfigData);
      showSnackbar('Configuration created successfully');
      setDialogOpen(false);
      setNewConfigData({
        key_name: '',
        value: '',
        data_type: 'string',
        category: 'general',
        description: '',
        is_public: false
      });
      fetchConfigs();
    } catch (error) {
      console.error('Error creating config:', error);
      showSnackbar('Error creating configuration', 'error');
    }
  };

  const handleDeleteConfig = async (key) => {
    if (window.confirm('Are you sure you want to delete this configuration?')) {
      try {
        await api.delete(`/bot-config/${key}`);
        showSnackbar('Configuration deleted successfully');
        fetchConfigs();
      } catch (error) {
        console.error('Error deleting config:', error);
        showSnackbar('Error deleting configuration', 'error');
      }
    }
  };

  const ConfigField = ({ config, onUpdate }) => {
    const [value, setValue] = useState(config.value);
    const [description, setDescription] = useState(config.description || '');

    const handleSave = () => {
      onUpdate(config.key_name, value, description);
    };

    const renderInput = () => {
      switch (config.data_type) {
        case 'boolean':
          return (
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(value)}
                  onChange={(e) => setValue(e.target.checked)}
                />
              }
              label={value ? 'Enabled' : 'Disabled'}
            />
          );
        
        case 'number':
          if (config.key_name.includes('delay') || config.key_name.includes('timeout')) {
            return (
              <Box sx={{ px: 2 }}>
                <Typography gutterBottom>
                  {config.key_name}: {value} seconds
                </Typography>
                <Slider
                  value={Number(value)}
                  onChange={(e, newValue) => setValue(newValue)}
                  min={0}
                  max={config.key_name.includes('timeout') ? 300 : 10}
                  step={0.5}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>
            );
          }
          return (
            <TextField
              fullWidth
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              InputProps={{
                endAdornment: config.key_name.includes('threshold') && (
                  <InputAdornment position="end">%</InputAdornment>
                )
              }}
            />
          );
        
        case 'json':
          return (
            <TextField
              fullWidth
              multiline
              rows={4}
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
              onChange={(e) => setValue(e.target.value)}
              helperText="Enter valid JSON"
            />
          );
        
        default:
          return (
            <TextField
              fullWidth
              multiline={config.key_name.includes('prompt') || config.key_name.includes('message')}
              rows={config.key_name.includes('prompt') ? 4 : 1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          );
      }
    };

    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" component="h3">
                {config.key_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {config.description}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={config.data_type}
                size="small"
                color="primary"
                variant="outlined"
              />
              {config.is_public && (
                <Chip
                  label="Public"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              {renderInput()}
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>
        </CardContent>
        
        <CardActions>
          <Button
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            variant="contained"
            size="small"
          >
            Save
          </Button>
          {config.default_value && (
            <Button
              startIcon={<ResetIcon />}
              onClick={() => handleResetConfig(config.key_name)}
              size="small"
            >
              Reset
            </Button>
          )}
          <Button
            startIcon={<DeleteIcon />}
            onClick={() => handleDeleteConfig(config.key_name)}
            size="small"
            color="error"
          >
            Delete
          </Button>
        </CardActions>
      </Card>
    );
  };

  const getCategoryIcon = (category) => {
    switch (category.toLowerCase()) {
      case 'ai':
      case 'gemini':
        return <PsychologyIcon />;
      case 'timing':
      case 'delays':
        return <TimerIcon />;
      case 'conversation':
      case 'chat':
        return <ChatIcon />;
      default:
        return <TuneIcon />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Bot Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            variant="outlined"
          >
            Add Configuration
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchConfigs}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          These settings control how the ESSEN bot behaves and responds to users. 
          Changes take effect immediately but may require a few seconds to propagate.
        </Typography>
      </Alert>

      {/* Configuration Categories */}
      {categories.map((category) => (
        <Accordion key={category} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getCategoryIcon(category)}
              <Typography variant="h6">
                {category.charAt(0).toUpperCase() + category.slice(1)} Settings
              </Typography>
              <Chip
                label={configs[category]?.length || 0}
                size="small"
                color="primary"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {configs[category]?.map((config) => (
              <ConfigField
                key={config.key_name}
                config={config}
                onUpdate={handleUpdateConfig}
              />
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Quick Configuration Presets */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Configuration Presets
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  Business Hours Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Optimized for peak business hours with faster responses
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => handleBulkUpdate([
                    { key_name: 'response_delay', value: '1' },
                    { key_name: 'typing_delay', value: '2' },
                    { key_name: 'human_intervention_threshold', value: '70' }
                  ])}
                >
                  Apply
                </Button>
              </CardActions>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  After Hours Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Slower, more detailed responses for non-urgent inquiries
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => handleBulkUpdate([
                    { key_name: 'response_delay', value: '3' },
                    { key_name: 'typing_delay', value: '4' },
                    { key_name: 'human_intervention_threshold', value: '50' }
                  ])}
                >
                  Apply
                </Button>
              </CardActions>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  High Traffic Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Minimal delays, maximum efficiency for busy periods
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => handleBulkUpdate([
                    { key_name: 'response_delay', value: '0.5' },
                    { key_name: 'typing_delay', value: '1' },
                    { key_name: 'human_intervention_threshold', value: '80' }
                  ])}
                >
                  Apply
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Create Configuration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Configuration</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Configuration Key"
                value={newConfigData.key_name}
                onChange={(e) => setNewConfigData({ ...newConfigData, key_name: e.target.value })}
                helperText="Use snake_case (e.g., max_response_length)"
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Data Type</InputLabel>
                <Select
                  value={newConfigData.data_type}
                  onChange={(e) => setNewConfigData({ ...newConfigData, data_type: e.target.value })}
                  label="Data Type"
                >
                  <MenuItem value="string">String</MenuItem>
                  <MenuItem value="number">Number</MenuItem>
                  <MenuItem value="boolean">Boolean</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Category"
                value={newConfigData.category}
                onChange={(e) => setNewConfigData({ ...newConfigData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Value"
                value={newConfigData.value}
                onChange={(e) => setNewConfigData({ ...newConfigData, value: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newConfigData.description}
                onChange={(e) => setNewConfigData({ ...newConfigData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newConfigData.is_public}
                    onChange={(e) => setNewConfigData({ ...newConfigData, is_public: e.target.checked })}
                  />
                }
                label="Public Configuration (accessible to bot)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateConfig} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

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

export default BotConfiguration;