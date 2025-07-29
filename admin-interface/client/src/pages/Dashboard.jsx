import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'

function Dashboard() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ESSEN Bot Admin Dashboard
        </Typography>
        <Typography variant="body1">
          Welcome to the admin interface. This dashboard is under construction.
        </Typography>
      </Box>
    </Container>
  )
}

export default Dashboard