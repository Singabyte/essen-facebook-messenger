import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  validate: () => api.get('/auth/validate'),
}

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  getConversations: (id, params) => api.get(`/users/${id}/conversations`, { params }),
}

// Conversations API
export const conversationsAPI = {
  getAll: (params) => api.get('/conversations', { params }),
  search: (query) => api.get('/conversations/search', { params: { q: query } }),
  getStats: () => api.get('/conversations/stats'),
}

// Appointments API
export const appointmentsAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  updateStatus: (id, status) => api.patch(`/appointments/${id}/status`, { status }),
}

// Analytics API
export const analyticsAPI = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getTimeline: (params) => api.get('/analytics/timeline', { params }),
  getCommands: () => api.get('/analytics/commands'),
  export: (params) => api.get('/analytics/export', { params }),
}

// Knowledge Base API
export const knowledgeBaseAPI = {
  getFiles: () => api.get('/knowledge-base/files'),
  getFile: (id) => api.get(`/knowledge-base/files/${id}`),
  updateFile: (id, content) => api.put(`/knowledge-base/files/${id}`, { content }),
  getHistory: (id) => api.get(`/knowledge-base/files/${id}/history`),
}

export default api