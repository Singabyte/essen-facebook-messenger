import React, { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Save,
  History,
  Refresh,
  Preview,
  Edit,
} from '@mui/icons-material'
import Editor from '@monaco-editor/react'
import { knowledgeBaseAPI } from '../services/api'
import { format } from 'date-fns'

function KnowledgeBase() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(0)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    if (files.length > 0) {
      fetchFileContent(files[selectedFile].id)
    }
  }, [selectedFile, files])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await knowledgeBaseAPI.getFiles()
      setFiles(response.data.files)
    } catch (error) {
      console.error('Error fetching files:', error)
      showSnackbar('Error loading files', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchFileContent = async (fileId) => {
    try {
      setLoading(true)
      const response = await knowledgeBaseAPI.getFile(fileId)
      setContent(response.data.content)
      setOriginalContent(response.data.content)
      setHasChanges(false)
    } catch (error) {
      console.error('Error fetching file content:', error)
      showSnackbar('Error loading file content', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!hasChanges) return

    try {
      setSaving(true)
      await knowledgeBaseAPI.updateFile(files[selectedFile].id, content)
      setOriginalContent(content)
      setHasChanges(false)
      showSnackbar('File saved successfully', 'success')
    } catch (error) {
      console.error('Error saving file:', error)
      showSnackbar('Error saving file', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEditorChange = (value) => {
    setContent(value || '')
    setHasChanges(value !== originalContent)
  }

  const handleTabChange = (event, newValue) => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
        setSelectedFile(newValue)
        setHasChanges(false)
      }
    } else {
      setSelectedFile(newValue)
    }
  }

  const handleRefresh = () => {
    fetchFileContent(files[selectedFile].id)
  }

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  const renderMarkdownPreview = () => {
    // Simple markdown to HTML conversion for preview
    let html = content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />')
      .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/- (.+)/g, '<li>$1</li>')

    // Wrap list items in ul
    html = html.replace(/(<li>.*<\/li>(\s*<br \/>)*)+/g, (match) => {
      return `<ul>${match.replace(/<br \/>/g, '')}</ul>`
    })

    return <div dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Knowledge Base Editor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Edit bot knowledge files and responses
            </Typography>
          </Box>
          <Box>
            {hasChanges && (
              <Chip
                label="Unsaved changes"
                color="warning"
                size="small"
                sx={{ mr: 2 }}
              />
            )}
            <Tooltip title="Preview">
              <IconButton onClick={() => setPreviewOpen(true)}>
                <Preview />
              </IconButton>
            </Tooltip>
            <Tooltip title="History">
              <IconButton onClick={() => setHistoryOpen(true)}>
                <History />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!hasChanges || saving}
              sx={{ ml: 2 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>

        <Paper sx={{ height: '70vh' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={selectedFile} onChange={handleTabChange}>
              {files.map((file, index) => (
                <Tab
                  key={file.id}
                  label={file.name}
                  icon={<Edit fontSize="small" />}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ height: 'calc(100% - 48px)', position: 'relative' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <CircularProgress />
              </Box>
            ) : (
              <Editor
                height="100%"
                language="markdown"
                theme="vs-light"
                value={content}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            )}
          </Box>
        </Paper>

        {/* Preview Dialog */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Markdown Preview</Typography>
              <Typography variant="caption" color="text.secondary">
                {files[selectedFile]?.name}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ 
              '& h1, & h2, & h3': { marginTop: 2, marginBottom: 1 },
              '& ul': { paddingLeft: 3 },
              '& code': { 
                backgroundColor: 'grey.100', 
                padding: '2px 4px', 
                borderRadius: 1,
                fontFamily: 'monospace',
              },
              '& pre': {
                backgroundColor: 'grey.100',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
              },
            }}>
              {renderMarkdownPreview()}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* History Dialog */}
        <Dialog
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Version History</DialogTitle>
          <DialogContent>
            <Alert severity="info">
              Version history feature coming soon. All changes are automatically backed up before saving.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
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

export default KnowledgeBase