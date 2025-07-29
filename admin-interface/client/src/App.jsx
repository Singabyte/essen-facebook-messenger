import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Box from '@mui/material/Box'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <Box sx={{ display: 'flex' }}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </Box>
  )
}

export default App