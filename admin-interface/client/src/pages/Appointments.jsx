import React, { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { EventNote, Phone, Person, CalendarToday } from '@mui/icons-material'
import DataTable from '../components/DataTable'
import { appointmentsAPI } from '../services/api'
import { format, parseISO } from 'date-fns'

function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchAppointments()
  }, [page, rowsPerPage])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const response = await appointmentsAPI.getAll({
        page: page + 1,
        limit: rowsPerPage,
      })
      setAppointments(response.data.appointments)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleRowClick = (appointment) => {
    setSelectedAppointment(appointment)
    setDialogOpen(true)
  }

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      await appointmentsAPI.updateStatus(appointmentId, newStatus)
      fetchAppointments()
      setDialogOpen(false)
    } catch (error) {
      console.error('Error updating appointment status:', error)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'success'
      case 'pending':
        return 'warning'
      case 'cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  const columns = [
    {
      field: 'facebook_name',
      headerName: 'Customer Name',
      minWidth: 200,
      render: (value) => (
        <Box display="flex" alignItems="center">
          <Person sx={{ mr: 1, fontSize: 20 }} />
          {value}
        </Box>
      ),
    },
    {
      field: 'appointment_date',
      headerName: 'Date',
      minWidth: 150,
      render: (value) => value ? format(parseISO(value), 'PP') : '-',
    },
    {
      field: 'appointment_time',
      headerName: 'Time',
      minWidth: 100,
    },
    {
      field: 'phone_number',
      headerName: 'Phone',
      minWidth: 150,
      render: (value) => value || '-',
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 120,
      render: (value) => (
        <Chip
          label={value || 'Pending'}
          size="small"
          color={getStatusColor(value)}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Requested On',
      minWidth: 180,
      type: 'date',
    },
  ]

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Appointments
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Manage consultation appointments
        </Typography>

        <DataTable
          columns={columns}
          data={appointments}
          total={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          onRowClick={handleRowClick}
          loading={loading}
        />
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <EventNote sx={{ mr: 1 }} />
            <Typography variant="h6">Appointment Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Customer Name"
                      secondary={selectedAppointment?.facebook_name}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Date & Time"
                      secondary={
                        selectedAppointment?.appointment_date
                          ? `${format(parseISO(selectedAppointment.appointment_date), 'PPP')} at ${selectedAppointment.appointment_time}`
                          : '-'
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Phone Number"
                      secondary={selectedAppointment?.phone_number || 'Not provided'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="User ID"
                      secondary={selectedAppointment?.user_id}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Requested On"
                      secondary={
                        selectedAppointment?.created_at
                          ? format(new Date(selectedAppointment.created_at), 'PPpp')
                          : '-'
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Status"
                      secondary={
                        <Chip
                          label={selectedAppointment?.status || 'Pending'}
                          size="small"
                          color={getStatusColor(selectedAppointment?.status)}
                        />
                      }
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleStatusUpdate(selectedAppointment?.id, 'confirmed')}
            color="success"
            variant="contained"
          >
            Confirm
          </Button>
          <Button
            onClick={() => handleStatusUpdate(selectedAppointment?.id, 'cancelled')}
            color="error"
          >
            Cancel
          </Button>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Appointments