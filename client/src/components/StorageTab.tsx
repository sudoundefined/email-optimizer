import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { api, ApiError } from '../api'
import type { StorageStats } from '../types'

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

export default function StorageTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await api.storageStats()
      setStats(s)
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }, [handleApiError])

  useEffect(() => { load() }, [load])

  const refresh = async () => {
    try {
      await api.storageRefresh()
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  if (loading) {
    return <Typography variant="body2" color="text.secondary">Analyzing your largest emails… this can take a moment.</Typography>
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>
  }

  if (!stats) return null

  const maxSenderMB = Math.max(1, ...stats.senders.map(s => s.totalMB))
  const maxMonthMB = Math.max(1, ...stats.months.map(m => m.totalMB))

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Storage analysis covers every email larger than 1 MB (outside Trash and Spam). Cached for 5 minutes.
        </Typography>
        <Button size="small" variant="outlined" onClick={refresh}>Refresh</Button>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Reclaimable storage</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>{stats.totalMB.toLocaleString()} MB</Typography>
              <Typography variant="body2" color="text.secondary">
                across {stats.messageCount.toLocaleString()} large emails
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Top senders by size</Typography>
              {stats.senders.length === 0 && <Typography variant="body2" color="text.secondary">No large emails found.</Typography>}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {stats.senders.map((s) => (
                  <Box key={s.email} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} title={`${s.email} — ${s.messageCount} emails`}>
                    <Typography variant="caption" noWrap sx={{ minWidth: 100, maxWidth: 100 }}>
                      {parseFromHeader(s.name)}
                    </Typography>
                    <Box
                      sx={{
                        height: 18,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        width: `${Math.max(4, (s.totalMB / maxSenderMB) * 140)}px`,
                        flexShrink: 0,
                        transition: 'width 200ms ease',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {s.totalMB.toLocaleString()} MB
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Storage by month</Typography>
              {stats.months.length === 0 && <Typography variant="body2" color="text.secondary">No large emails found.</Typography>}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {stats.months.map((m) => (
                  <Box key={m.month} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} title={`${m.messageCount} emails`}>
                    <Typography variant="caption" noWrap sx={{ minWidth: 100, maxWidth: 100 }}>
                      {m.month}
                    </Typography>
                    <Box
                      sx={{
                        height: 18,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        width: `${Math.max(4, (m.totalMB / maxMonthMB) * 140)}px`,
                        flexShrink: 0,
                        transition: 'width 200ms ease',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {m.totalMB.toLocaleString()} MB
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Largest attachments (&gt;5 MB)</Typography>
      {stats.attachments.length === 0 && (
        <Typography variant="body2" color="text.secondary">No attachments larger than 5 MB found.</Typography>
      )}
      {stats.attachments.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="right">Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.attachments.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{parseFromHeader(a.from)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{a.subject || '(no subject)'}</Typography>
                  </TableCell>
                  <TableCell align="right">{a.sizeMB.toLocaleString()} MB</TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">
                      {new Date(a.date).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Typography>
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
