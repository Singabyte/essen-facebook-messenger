import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Conversations from './pages/Conversations'
import Appointments from './pages/Appointments'
import KnowledgeBase from './pages/KnowledgeBase'
import Settings from './pages/Settings'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Box sx={{ display: 'flex' }}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/conversations" element={<Conversations />} />
                    <Route path="/appointments" element={<Appointments />} />
                    <Route path="/knowledge-base" element={<KnowledgeBase />} />
                    <Route path="/analytics" element={<div>Analytics</div>} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
          </Routes>
        </Box>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App