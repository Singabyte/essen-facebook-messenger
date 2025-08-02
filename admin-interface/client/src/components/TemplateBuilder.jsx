import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  DragIndicator as DragIcon,
  Message as MessageIcon,
  Image as ImageIcon,
  QuestionAnswer as QuestionIcon,
  Schedule as DelayIcon,
  Person as UserIcon,
  SmartToy as BotIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowUp as UpIcon,
  KeyboardArrowDown as DownIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  QUICK_REPLY: 'quick_reply',
  DELAY: 'delay',
  CONDITION: 'condition',
  USER_INPUT: 'user_input'
};

const STEP_ICONS = {
  [MESSAGE_TYPES.TEXT]: MessageIcon,
  [MESSAGE_TYPES.IMAGE]: ImageIcon,
  [MESSAGE_TYPES.QUICK_REPLY]: QuestionIcon,
  [MESSAGE_TYPES.DELAY]: DelayIcon,
  [MESSAGE_TYPES.CONDITION]: UserIcon,
  [MESSAGE_TYPES.USER_INPUT]: UserIcon,
};

function TemplateBuilder({ template, onSave, onClose }) {
  const [steps, setSteps] = useState(template?.steps || []);
  const [selectedStep, setSelectedStep] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStep, setPreviewStep] = useState(0);
  
  const [stepForm, setStepForm] = useState({
    type: MESSAGE_TYPES.TEXT,
    content: '',
    media_url: '',
    quick_replies: [],
    delay_seconds: 2,
    condition: '',
    variable_name: '',
    validation: ''
  });

  const createNewStep = (type) => {
    const newStep = {
      id: Date.now().toString(),
      type,
      order: steps.length,
      ...getDefaultStepData(type)
    };
    
    setSteps([...steps, newStep]);
  };

  const getDefaultStepData = (type) => {
    switch (type) {
      case MESSAGE_TYPES.TEXT:
        return { content: 'New message', sender: 'bot' };
      case MESSAGE_TYPES.IMAGE:
        return { content: 'Image message', media_url: '', sender: 'bot' };
      case MESSAGE_TYPES.QUICK_REPLY:
        return { 
          content: 'Choose an option:', 
          quick_replies: [{ title: 'Option 1', payload: 'option_1' }],
          sender: 'bot'
        };
      case MESSAGE_TYPES.DELAY:
        return { delay_seconds: 2 };
      case MESSAGE_TYPES.CONDITION:
        return { condition: '', true_branch: [], false_branch: [] };
      case MESSAGE_TYPES.USER_INPUT:
        return { 
          content: 'Please provide your input:',
          variable_name: 'user_input',
          validation: 'text',
          sender: 'bot'
        };
      default:
        return {};
    }
  };

  const editStep = (step) => {
    setSelectedStep(step);
    setStepForm({
      type: step.type,
      content: step.content || '',
      media_url: step.media_url || '',
      quick_replies: step.quick_replies || [],
      delay_seconds: step.delay_seconds || 2,
      condition: step.condition || '',
      variable_name: step.variable_name || '',
      validation: step.validation || 'text'
    });
    setEditDialogOpen(true);
  };

  const saveStep = () => {
    const updatedSteps = steps.map(step => 
      step.id === selectedStep.id 
        ? { ...step, ...stepForm }
        : step
    );
    setSteps(updatedSteps);
    setEditDialogOpen(false);
    setSelectedStep(null);
  };

  const deleteStep = (stepId) => {
    const updatedSteps = steps.filter(step => step.id !== stepId)
      .map((step, index) => ({ ...step, order: index }));
    setSteps(updatedSteps);
  };

  const moveStep = (stepId, direction) => {
    const stepIndex = steps.findIndex(step => step.id === stepId);
    if ((direction === 'up' && stepIndex === 0) || 
        (direction === 'down' && stepIndex === steps.length - 1)) {
      return;
    }
    
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    
    // Swap steps
    [newSteps[stepIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[stepIndex]];
    
    // Update order
    newSteps.forEach((step, index) => step.order = index);
    setSteps(newSteps);
  };

  const duplicateStep = (step) => {
    const newStep = {
      ...step,
      id: Date.now().toString(),
      order: step.order + 1
    };
    
    const newSteps = [...steps];
    newSteps.splice(step.order + 1, 0, newStep);
    newSteps.forEach((s, index) => s.order = index);
    setSteps(newSteps);
  };

  const addQuickReply = () => {
    setStepForm({
      ...stepForm,
      quick_replies: [...stepForm.quick_replies, { title: '', payload: '' }]
    });
  };

  const updateQuickReply = (index, field, value) => {
    const newQuickReplies = [...stepForm.quick_replies];
    newQuickReplies[index][field] = value;
    setStepForm({ ...stepForm, quick_replies: newQuickReplies });
  };

  const removeQuickReply = (index) => {
    const newQuickReplies = stepForm.quick_replies.filter((_, i) => i !== index);
    setStepForm({ ...stepForm, quick_replies: newQuickReplies });
  };

  const previewConversation = () => {
    setPreviewMode(true);
    setPreviewStep(0);
  };

  const nextPreviewStep = () => {
    if (previewStep < steps.length - 1) {
      setPreviewStep(previewStep + 1);
    }
  };

  const prevPreviewStep = () => {
    if (previewStep > 0) {
      setPreviewStep(previewStep - 1);
    }
  };

  const renderStepCard = (step, index) => {
    const StepIcon = STEP_ICONS[step.type] || MessageIcon;
    
    return (
      <Card key={step.id} sx={{ mb: 2, border: selectedStep?.id === step.id ? 2 : 1, borderColor: selectedStep?.id === step.id ? 'primary.main' : 'divider' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <DragIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <StepIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Step {index + 1}: {step.type.replace('_', ' ').toUpperCase()}
            </Typography>
            <Chip 
              label={step.sender || 'bot'} 
              size="small" 
              color={step.sender === 'user' ? 'secondary' : 'primary'}
              icon={step.sender === 'user' ? <UserIcon /> : <BotIcon />}
            />
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {step.content || `${step.type} configuration`}
          </Typography>
          
          {step.type === MESSAGE_TYPES.QUICK_REPLY && step.quick_replies?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {step.quick_replies.map((reply, i) => (
                <Chip key={i} label={reply.title} size="small" variant="outlined" />
              ))}
            </Box>
          )}
          
          {step.type === MESSAGE_TYPES.DELAY && (
            <Chip label={`${step.delay_seconds}s delay`} size="small" color="info" />
          )}
          
          {step.media_url && (
            <Chip label="Has media" size="small" color="success" icon={<ImageIcon />} />
          )}
        </CardContent>
        
        <CardActions>
          <Button size="small" startIcon={<EditIcon />} onClick={() => editStep(step)}>
            Edit
          </Button>
          <Button size="small" startIcon={<CopyIcon />} onClick={() => duplicateStep(step)}>
            Duplicate
          </Button>
          <IconButton size="small" onClick={() => moveStep(step.id, 'up')} disabled={index === 0}>
            <UpIcon />
          </IconButton>
          <IconButton size="small" onClick={() => moveStep(step.id, 'down')} disabled={index === steps.length - 1}>
            <DownIcon />
          </IconButton>
          <IconButton size="small" onClick={() => deleteStep(step.id)} color="error">
            <DeleteIcon />
          </IconButton>
        </CardActions>
      </Card>
    );
  };

  const renderPreview = () => {
    if (steps.length === 0) return null;
    
    const currentStep = steps[previewStep];
    if (!currentStep) return null;
    
    return (
      <Box sx={{ maxWidth: 400, mx: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          Conversation Preview - Step {previewStep + 1} of {steps.length}
        </Typography>
        
        <Paper sx={{ p: 2, mb: 2, bgcolor: currentStep.sender === 'user' ? 'primary.light' : 'grey.100' }}>
          {currentStep.type === MESSAGE_TYPES.TEXT && (
            <Typography>{currentStep.content}</Typography>
          )}
          
          {currentStep.type === MESSAGE_TYPES.IMAGE && (
            <Box>
              <Typography>{currentStep.content}</Typography>
              {currentStep.media_url && (
                <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.200', textAlign: 'center' }}>
                  <ImageIcon />
                  <Typography variant="caption" display="block">
                    {currentStep.media_url}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
          {currentStep.type === MESSAGE_TYPES.QUICK_REPLY && (
            <Box>
              <Typography>{currentStep.content}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {currentStep.quick_replies?.map((reply, i) => (
                  <Button key={i} variant="outlined" size="small">
                    {reply.title}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
          
          {currentStep.type === MESSAGE_TYPES.DELAY && (
            <Typography color="text.secondary" fontStyle="italic">
              Waiting {currentStep.delay_seconds} seconds...
            </Typography>
          )}
          
          {currentStep.type === MESSAGE_TYPES.USER_INPUT && (
            <Box>
              <Typography>{currentStep.content}</Typography>
              <TextField 
                fullWidth 
                size="small" 
                placeholder="User will type here..." 
                sx={{ mt: 1 }}
                disabled
              />
            </Box>
          )}
        </Paper>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={prevPreviewStep} disabled={previewStep === 0}>
            Previous
          </Button>
          <Button onClick={nextPreviewStep} disabled={previewStep === steps.length - 1}>
            Next
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      {/* Left Panel - Step Types */}
      <Paper sx={{ width: 250, p: 2, borderRadius: 0 }}>
        <Typography variant="h6" gutterBottom>
          Message Types
        </Typography>
        
        <List dense>
          {Object.entries(MESSAGE_TYPES).map(([key, type]) => {
            const Icon = STEP_ICONS[type];
            return (
              <ListItem
                key={type}
                button
                onClick={() => createNewStep(type)}
                sx={{ borderRadius: 1, mb: 1 }}
              >
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText 
                  primary={key.replace('_', ' ')}
                  secondary={getStepDescription(type)}
                />
              </ListItem>
            );
          })}
        </List>
        
        <Divider sx={{ my: 2 }} />
        
        <Button
          fullWidth
          variant="contained"
          startIcon={<PlayIcon />}
          onClick={previewConversation}
          disabled={steps.length === 0}
          sx={{ mb: 1 }}
        >
          Preview
        </Button>
        
        <Button
          fullWidth
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={() => onSave({ ...template, steps })}
        >
          Save Template
        </Button>
      </Paper>

      {/* Main Panel */}
      <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
        {previewMode ? (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">
                Preview Mode
              </Typography>
              <Button onClick={() => setPreviewMode(false)}>
                Back to Editor
              </Button>
            </Box>
            {renderPreview()}
          </Box>
        ) : (
          <Box>
            <Typography variant="h5" gutterBottom>
              Conversation Flow Builder
            </Typography>
            
            {steps.length === 0 ? (
              <Alert severity="info">
                Start building your conversation by adding message types from the left panel.
                You can create text messages, images, quick replies, delays, and user inputs.
              </Alert>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Drag and drop steps to reorder them. Click edit to modify step content.
                </Typography>
                {steps.map((step, index) => renderStepCard(step, index))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Edit Step Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit {stepForm.type.replace('_', ' ').toUpperCase()} Step
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {(stepForm.type === MESSAGE_TYPES.TEXT || 
              stepForm.type === MESSAGE_TYPES.IMAGE || 
              stepForm.type === MESSAGE_TYPES.QUICK_REPLY ||
              stepForm.type === MESSAGE_TYPES.USER_INPUT) && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Message Content"
                  value={stepForm.content}
                  onChange={(e) => setStepForm({ ...stepForm, content: e.target.value })}
                  multiline
                  rows={3}
                />
              </Grid>
            )}
            
            {stepForm.type === MESSAGE_TYPES.IMAGE && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Image URL"
                  value={stepForm.media_url}
                  onChange={(e) => setStepForm({ ...stepForm, media_url: e.target.value })}
                />
              </Grid>
            )}
            
            {stepForm.type === MESSAGE_TYPES.DELAY && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Delay (seconds)"
                  type="number"
                  value={stepForm.delay_seconds}
                  onChange={(e) => setStepForm({ ...stepForm, delay_seconds: parseFloat(e.target.value) || 2 })}
                />
              </Grid>
            )}
            
            {stepForm.type === MESSAGE_TYPES.USER_INPUT && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Variable Name"
                    value={stepForm.variable_name}
                    onChange={(e) => setStepForm({ ...stepForm, variable_name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Validation</InputLabel>
                    <Select
                      value={stepForm.validation}
                      onChange={(e) => setStepForm({ ...stepForm, validation: e.target.value })}
                      label="Validation"
                    >
                      <MenuItem value="text">Text</MenuItem>
                      <MenuItem value="email">Email</MenuItem>
                      <MenuItem value="phone">Phone</MenuItem>
                      <MenuItem value="number">Number</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            
            {stepForm.type === MESSAGE_TYPES.QUICK_REPLY && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Quick Replies
                </Typography>
                {stepForm.quick_replies.map((reply, index) => (
                  <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                    <Grid item xs={5}>
                      <TextField
                        fullWidth
                        label="Button Text"
                        value={reply.title}
                        onChange={(e) => updateQuickReply(index, 'title', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={5}>
                      <TextField
                        fullWidth
                        label="Payload/Value"
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
                <Button onClick={addQuickReply} startIcon={<AddIcon />}>
                  Add Quick Reply
                </Button>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveStep} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function getStepDescription(type) {
  switch (type) {
    case MESSAGE_TYPES.TEXT:
      return 'Simple text message';
    case MESSAGE_TYPES.IMAGE:
      return 'Image with caption';
    case MESSAGE_TYPES.QUICK_REPLY:
      return 'Message with buttons';
    case MESSAGE_TYPES.DELAY:
      return 'Pause in conversation';
    case MESSAGE_TYPES.CONDITION:
      return 'Conditional branching';
    case MESSAGE_TYPES.USER_INPUT:
      return 'Collect user input';
    default:
      return '';
  }
}

export default TemplateBuilder;