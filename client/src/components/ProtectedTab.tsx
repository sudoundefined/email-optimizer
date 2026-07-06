import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { ShieldOutlined } from '@mui/icons-material'
import { api, ApiError } from '../api'
import type { ProtectedSender } from '../types'

export default function ProtectedTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [list, setList] = useState<ProtectedSender[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.protectedList()
      setList(res.protected)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }, [onDisconnected])

  useEffect(() => { load() }, [load])

  const handleUnprotect = async (email: string) => {
    try {
      await api.unprotectSenders([email])
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (list === null && !error) {
    return <Typography variant="body2" color="text.secondary">Loading protected senders…</Typography>
  }

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {list && list.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 9, color: 'text.secondary' }}>
          <ShieldOutlined sx={{ fontSize: 56, opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" color="text.primary" gutterBottom>
            No protected senders yet
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>
            Protect senders to exclude them from bulk unsubscribe and trash actions.
            Senders matching banks, utilities, and government agencies are auto-protected after each scan.
          </Typography>
        </Box>
      )}
      {list && list.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Added</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.email} hover>
                  <TableCell>
                    <Typography variant="body2">{p.email}</Typography>
                  </TableCell>
                  <TableCell>
                    {p.reason.startsWith('auto:') ? (
                      <Chip size="small" label="Auto" color="info" />
                    ) : (
                      <Chip size="small" label="Manual" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(p.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="text" onClick={() => handleUnprotect(p.email)}>
                      Unprotect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  )
}
