import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  Visibility,
  Search,
  Download,
} from '@mui/icons-material'

function DataTable({
  columns,
  data,
  total,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  searchable = false,
  onSearch,
  exportable = false,
  onExport,
  loading = false,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value)
    if (onSearch) {
      onSearch(event.target.value)
    }
  }

  const renderCellContent = (row, column) => {
    const value = row[column.field]
    
    if (column.render) {
      return column.render(value, row)
    }

    if (column.type === 'date') {
      return value ? new Date(value).toLocaleString() : '-'
    }

    if (column.type === 'chip') {
      return value ? <Chip label={value} size="small" /> : '-'
    }

    return value || '-'
  }

  return (
    <Paper>
      {(searchable || exportable) && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            {searchable && (
              <TextField
                placeholder="Search..."
                size="small"
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ maxWidth: 300 }}
              />
            )}
            {exportable && (
              <Tooltip title="Export data">
                <IconButton onClick={onExport}>
                  <Download />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}
      
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    {column.headerName}
                  </Typography>
                </TableCell>
              ))}
              {onRowClick && (
                <TableCell align="center" width={50}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Actions
                  </Typography>
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onRowClick ? 1 : 0)} align="center">
                  <Typography color="text.secondary">Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onRowClick ? 1 : 0)} align="center">
                  <Typography color="text.secondary">No data available</Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow
                  key={row.id || index}
                  hover
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.field} align={column.align || 'left'}>
                      {renderCellContent(row, column)}
                    </TableCell>
                  ))}
                  {onRowClick && (
                    <TableCell align="center">
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => onRowClick(row)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        rowsPerPageOptions={[10, 20, 50, 100]}
        component="div"
        count={total}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    </Paper>
  )
}

export default DataTable