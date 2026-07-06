import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { LabelOutlined } from '@mui/icons-material'
import { api, ApiError } from '../api'
import type { AppLabel } from '../types'
import { useJob } from '../hooks/useJob'
import ConfirmDialog from './ConfirmDialog'

export default function LabelManager({ onDisconnected }: { onDisconnected: () => void }) {
  const [labels, setLabels] = useState<AppLabel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ label: AppLabel; mode: 'labelOnly' | 'trashEmails' } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const trashJob = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async () => {
    try {
      setLabels(await api.labels())
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    load()
  }, [load])

  const execute = async () => {
    if (!confirm) return
    const { label, mode } = confirm
    setConfirm(null)
    setError(null)
    setBusyId(label.id)
    try {
      if (mode === 'labelOnly') {
        await api.deleteLabelOnly(label.id)
      } else {
        const snapshot = await trashJob.start(() => api.trashLabel(label.id))
        if (snapshot.state === 'error') setError(snapshot.error || 'Trashing failed')
      }
      await load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusyId(null)
    }
  }

  const progress = trashJob.job?.progress as
    | { phase?: string; collected?: number; trashed?: number; total?: number }
    | null

  if (labels === null && !error) {
    return <Typography variant="body2" color="text.secondary">Loading labels…</Typography>
  }

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashJob.running && progress && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {progress.phase === 'collecting' && `Collecting emails… ${progress.collected ?? 0}`}
            {progress.phase === 'trashing' &&
              `Moving to Trash… ${progress.trashed ?? 0} / ${progress.total ?? '?'}`}
          </Typography>
          <LinearProgress sx={{ mt: 0.5 }} />
        </Box>
      )}

      {labels && labels.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 9, color: 'text.secondary' }}>
          <LabelOutlined sx={{ fontSize: 56, opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" color="text.primary" gutterBottom>
            No labels yet
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>
            Scan your mailbox on the Senders tab, select senders and use "Label…" to sort them into
            Gmail labels you can manage here.
          </Typography>
        </Box>
      )}

      {labels && labels.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell align="right">Emails</TableCell>
                <TableCell align="right">Unread</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {labels.map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.name}</Typography>
                  </TableCell>
                  <TableCell align="right">{l.messagesTotal.toLocaleString()}</TableCell>
                  <TableCell align="right">{l.messagesUnread.toLocaleString()}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        disabled={busyId === l.id}
                        onClick={() => setConfirm({ label: l, mode: 'labelOnly' })}
                      >
                        Remove label, keep emails
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={busyId === l.id}
                        onClick={() => setConfirm({ label: l, mode: 'trashEmails' })}
                      >
                        Trash emails + delete label
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.mode === 'labelOnly'
              ? `Remove label "${confirm.label.name}"?`
              : `Delete "${confirm.label.name}" and trash its emails?`
          }
          message={
            confirm.mode === 'labelOnly'
              ? `The label will be removed from Gmail. Its ${confirm.label.messagesTotal} emails stay in your mailbox.`
              : `This moves ${confirm.label.messagesTotal} emails to Trash (recoverable for 30 days, then Gmail deletes them permanently) and removes the label.`
          }
          requireTypedCount={confirm.mode === 'trashEmails' && confirm.label.messagesTotal > 500 ? confirm.label.messagesTotal : undefined}
          danger={confirm.mode === 'trashEmails'}
          onCancel={() => setConfirm(null)}
          onConfirm={execute}
        />
      )}
    </div>
  )
}
