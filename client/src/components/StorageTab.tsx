import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { api, ApiError } from '../api'
import type { StorageAttachment, StorageStats } from '../types'
import ConfirmDialog from './ConfirmDialog'
import { useJob } from '../hooks/useJob'

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

export default function StorageTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trashDone, setTrashDone] = useState<string | null>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)

  // attachment selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const trashJob = useJob()

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
    setSelectedIds(new Set())
    setTrashDone(null)
    try {
      await api.storageRefresh()
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  const toggleAttachment = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllAttachments = () => {
    if (!stats) return
    const allIds = stats.attachments.map((a) => a.id)
    const allSelected = allIds.every((id) => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(allIds))
  }

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setTrashDone(null)
    const ids = [...selectedIds]
    try {
      const response = await api.trashMessages(ids)
      if ('jobId' in response && response.jobId) {
        const snapshot = await trashJob.start(() => Promise.resolve({ jobId: (response as { jobId: string }).jobId }))
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Move to Trash failed')
          return
        }
      }
      const count = 'trashed' in response ? response.trashed : ids.length
      setTrashDone(`Moved ${count.toLocaleString()} messages to Trash. Recoverable in Gmail for 30 days.`)
      setSelectedIds(new Set())
      // remove from local attachment list
      setStats((prev) =>
        prev
          ? { ...prev, attachments: prev.attachments.filter((a) => !ids.includes(a.id)) }
          : prev
      )
    } catch (err) {
      handleApiError(err)
    }
  }

  if (loading) {
    return <Typography variant="body2" color="text.secondary">Analyzing your largest emails… this can take a moment.</Typography>
  }

  if (error && !stats) {
    return <Alert severity="error">{error}</Alert>
  }

  if (!stats) return null

  const maxSenderMB = Math.max(1, ...stats.senders.map((s) => s.totalMB))
  const maxMonthMB = Math.max(1, ...stats.months.map((m) => m.totalMB))
  const allAttachmentsSelected =
    stats.attachments.length > 0 && stats.attachments.every((a) => selectedIds.has(a.id))

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Storage analysis covers every email larger than 1 MB (outside Trash and Spam). Cached for 5 minutes.
        </Typography>
        <Button size="small" variant="outlined" onClick={refresh}>Refresh</Button>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Reclaimable storage */}
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

        {/* Top senders by size */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Top senders by size</Typography>
              {stats.senders.length === 0 && (
                <Typography variant="body2" color="text.secondary">No large emails found.</Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {stats.senders.map((s) => (
                  <Box
                    key={s.email}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    title={`${s.email} — ${s.messageCount} emails`}
                  >
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

        {/* Storage by month */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Storage by month</Typography>
              {stats.months.length === 0 && (
                <Typography variant="body2" color="text.secondary">No large emails found.</Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {stats.months.map((m) => (
                  <Box
                    key={m.month}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    title={`${m.messageCount} emails`}
                  >
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

      {/* Largest attachments table — selectable */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Largest attachments (&gt;5 MB)</Typography>
        {selectedIds.size > 0 && (
          <Chip
            label={`${selectedIds.size} selected`}
            color="primary"
            size="small"
            onDelete={() => setSelectedIds(new Set())}
          />
        )}
      </Box>

      {stats.attachments.length === 0 && (
        <Typography variant="body2" color="text.secondary">No attachments larger than 5 MB found.</Typography>
      )}

      {stats.attachments.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allAttachmentsSelected}
                    indeterminate={selectedIds.size > 0 && !allAttachmentsSelected}
                    onChange={toggleAllAttachments}
                    aria-label="Select all attachments"
                  />
                </TableCell>
                <TableCell>From</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="right">Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.attachments.map((a: StorageAttachment) => (
                <TableRow
                  key={a.id}
                  hover
                  selected={selectedIds.has(a.id)}
                  onClick={() => toggleAttachment(a.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleAttachment(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${a.subject || '(no subject)'}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {parseFromHeader(a.from)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {a.subject || '(no subject)'}
                    </Typography>
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

      {/* Floating trash tray */}
      {selectedIds.size > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'grey.900',
            color: 'common.white',
            borderRadius: 3,
            px: 2.5,
            py: 1.5,
            zIndex: 50,
            maxWidth: 'min(92vw, 600px)',
          }}
          role="toolbar"
          aria-label="Actions for selected messages"
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
            <Chip label={selectedIds.size} color="primary" size="small" />
            <Typography variant="body2" sx={{ color: 'grey.400' }}>
              attachments selected
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              color="error"
              disabled={trashJob.running}
              onClick={() => setConfirmTrash(true)}
            >
              Move to Trash
            </Button>
            <Button
              variant="text"
              size="small"
              sx={{ color: 'grey.500' }}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

      {confirmTrash && (
        <ConfirmDialog
          title={`Move ${selectedIds.size.toLocaleString()} messages to Trash?`}
          message="These messages (and their attachments) will move to Gmail Trash, recoverable for 30 days. Nothing is permanently deleted."
          danger
          requireTypedCount={selectedIds.size > 50 ? selectedIds.size : undefined}
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}
    </div>
  )
}
