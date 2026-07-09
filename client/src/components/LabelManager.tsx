import { useCallback, useEffect, useState, useMemo } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import LinearProgress from '@mui/material/LinearProgress'
import {
  LabelOutlined,
  DeleteOutlined,
  ClearOutlined,
  SearchOutlined,
} from '@mui/icons-material'
import { api, ApiError } from '../api'
import type { GmailLabel, GroupMessage } from '../types'
import { useJob } from '../hooks/useJob'
import ConfirmDialog from './ConfirmDialog'

function prettyLabelName(l: GmailLabel): string {
  if (l.type !== 'system') return l.name
  return l.name
    .toLowerCase()
    .replace(/^category_/, 'category: ')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

export default function LabelManager({ onDisconnected }: { onDisconnected: () => void }) {
  const [labels, setLabels] = useState<GmailLabel[] | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<GmailLabel | null>(null)
  const [messages, setMessages] = useState<GroupMessage[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [search, setSearch] = useState('')
  
  // message selection within selected label
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set())
  const [confirmTrashMsgs, setConfirmTrashMsgs] = useState(false)
  const [trashMsgsDone, setTrashMsgsDone] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [confirmLabelAction, setConfirmLabelAction] = useState<{ label: GmailLabel; mode: 'labelOnly' | 'trashEmails' } | null>(null)
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
      const all = await api.allLabels()
      setLabels(all)
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => { load() }, [load])

  const loadMessages = useCallback(async (label: GmailLabel) => {
    setMessagesLoading(true)
    setTrashMsgsDone(null)
    setSelectedMsgIds(new Set())
    try {
      const msgs = await api.labelMessages(label.id)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setMessages(null)
    } finally {
      setMessagesLoading(false)
    }
  }, [handleApiError])

  useEffect(() => {
    if (selectedLabel) {
      loadMessages(selectedLabel)
    } else {
      setMessages(null)
    }
  }, [selectedLabel, loadMessages])

  // execute deleting app-created labels
  const executeLabelAction = async () => {
    if (!confirmLabelAction) return
    const { label, mode } = confirmLabelAction
    setConfirmLabelAction(null)
    setError(null)
    setBusyId(label.id)
    try {
      if (mode === 'labelOnly') {
        await api.deleteLabelOnly(label.id)
      } else {
        const snapshot = await trashJob.start(() => api.trashLabel(label.id))
        if (snapshot.state === 'error') setError(snapshot.error || 'Trashing failed')
      }
      
      if (selectedLabel?.id === label.id) {
        setSelectedLabel(null)
        setMessages(null)
        setSelectedMsgIds(new Set())
      }
      await load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusyId(null)
    }
  }

  // bulk trash individual messages selected in the right pane
  const executeTrashMessages = async () => {
    setConfirmTrashMsgs(false)
    setError(null)
    setTrashMsgsDone(null)
    const ids = [...selectedMsgIds]
    try {
      const response = await api.trashMessages(ids)
      if ('jobId' in response && response.jobId) {
        const snapshot = await trashJob.start(() => Promise.resolve({ jobId: response.jobId! }))
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Move to Trash failed')
          return
        }
      }
      const count = 'trashed' in response ? response.trashed : ids.length
      setTrashMsgsDone(`Moved ${count.toLocaleString()} messages to Trash.`)
      setSelectedMsgIds(new Set())
      
      if (selectedLabel) {
        loadMessages(selectedLabel)
      }
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  const filteredLabels = useMemo(() => {
    if (!labels) return []
    const q = search.toLowerCase().trim()
    if (!q) return labels
    return labels.filter((l) => l.name.toLowerCase().includes(q))
  }, [labels, search])

  const toggleMessage = (id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllMessages = () => {
    if (!messages) return
    const allSelected = messages.length > 0 && messages.every((m) => selectedMsgIds.has(m.id))
    if (allSelected) {
      const next = new Set(selectedMsgIds)
      messages.forEach((m) => next.delete(m.id))
      setSelectedMsgIds(next)
    } else {
      setSelectedMsgIds(new Set([...selectedMsgIds, ...messages.map((m) => m.id)]))
    }
  }

  const allSelected = messages && messages.length > 0 && messages.every((m) => selectedMsgIds.has(m.id))

  const progress = trashJob.job?.progress as
    | { phase?: string; collected?: number; trashed?: number; total?: number }
    | null

  if (labels === null && !error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
        <CircularProgress size={24} sx={{ color: '#f59e0b' }} />
        <Typography variant="body2">Loading labels…</Typography>
      </Box>
    )
  }

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashMsgsDone && <Alert severity="success" sx={{ mb: 2 }}>{trashMsgsDone}</Alert>}
      {trashJob.running && progress && (
        <Box sx={{ mb: 2, p: 2, borderRadius: 2, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {progress.phase === 'collecting' && `🔍 Collecting emails… ${progress.collected ?? 0}`}
            {progress.phase === 'trashing' && `🗑️ Moving to Trash… ${progress.trashed ?? 0} / ${progress.total ?? '?'}`}
          </Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Box>
      )}

      <Grid container spacing={3}>
        {/* LEFT PANE — Labels list */}
        <Grid size={{ xs: 12, md: 4.5, lg: 3.5 }}>
          <Card
            sx={{
              borderRadius: 0,
              overflow: 'hidden',
              animation: 'fadeInUp 0.5s ease-out',
            }}
          >
            {/* Header strip */}
            <Box
              sx={{
                px: 2, py: 1.5,
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                display: 'flex', alignItems: 'center', gap: 1.5,
              }}
            >
              <LabelOutlined sx={{ color: '#fff', fontSize: 18 }} />
              <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>
                Gmail Labels
              </Typography>
              {labels && (
                <Chip
                  label={labels.length}
                  size="small"
                  sx={{ ml: 'auto', background: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, height: 20 }}
                />
              )}
            </Box>

            <CardContent sx={{ p: 2 }}>
              <TextField
                placeholder="Search labels..."
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 2 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }
                }}
              />

              {filteredLabels.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No labels found.
                </Typography>
              ) : (
                <List
                  dense
                  disablePadding
                  sx={{
                    maxHeight: 'calc(100vh - 280px)',
                    minHeight: 400,
                    overflowY: 'auto',
                    pr: 0.5,
                  }}
                >
                  {filteredLabels.map((l) => {
                    const isSelected = selectedLabel?.id === l.id
                    return (
                      <ListItemButton
                        key={l.id}
                        selected={isSelected}
                        onClick={() => setSelectedLabel(l)}
                        sx={{
                          borderRadius: '24px',
                          mb: 1,
                          py: 1,
                          px: 2.5,
                          border: isSelected ? '1px solid #f59e0b' : '1px solid rgba(30, 41, 59, 0.08)',
                          bgcolor: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                          '&.Mui-selected': {
                            bgcolor: 'rgba(245, 158, 11, 0.08)',
                            '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.12)' },
                          },
                          '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.04)' },
                        }}
                      >
                        <Stack spacing={1} sx={{ width: '100%' }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#f59e0b' : 'text.primary',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '200px',
                              }}
                            >
                              {prettyLabelName(l)}
                            </Typography>
                            {l.appCreated ? (
                              <Box sx={{ px: 0.75, py: 0.25, borderRadius: '4px', background: 'linear-gradient(135deg,#10b981,#34d399)', fontSize: '0.65rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>App</Box>
                            ) : l.type === 'system' ? (
                              <Box sx={{ px: 0.75, py: 0.25, borderRadius: '4px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.65rem', fontWeight: 500, color: 'text.secondary', lineHeight: 1 }}>Sys</Box>
                            ) : (
                              <Box sx={{ px: 0.75, py: 0.25, borderRadius: '4px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontSize: '0.65rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>User</Box>
                            )}
                          </Stack>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {l.messagesTotal.toLocaleString()} emails
                            </Typography>
                            {l.messagesUnread > 0 && (
                              <Chip
                                label={`${l.messagesUnread} unread`}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  border: 'none',
                                }}
                              />
                            )}
                          </Stack>
                        </Stack>
                      </ListItemButton>
                    )
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT PANE — Detail content */}
        <Grid size={{ xs: 12, md: 7.5, lg: 8.5 }}>
          {selectedLabel ? (
            <Card
              variant="outlined"
              sx={{
                border: '1px solid rgba(30, 41, 59, 0.1)',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 200px)',
                minHeight: 400,
                animation: 'fadeInUp 0.4s ease-out',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Header section inside Right Card */}
              <Box sx={{ p: 3, borderBottom: '1px solid rgba(30, 41, 59, 0.06)' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {prettyLabelName(selectedLabel)}
                      </Typography>
                      {selectedLabel.appCreated ? (
                        <Chip label="App-Created" size="small" color="success" sx={{ fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
                      ) : selectedLabel.type === 'system' ? (
                        <Chip label="System Label" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                      ) : (
                        <Chip label="User Label" size="small" color="primary" sx={{ fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Browse messages tagged with this label.
                    </Typography>
                  </Box>

                  {/* Actions for App Created Labels */}
                  {selectedLabel.appCreated && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={<ClearOutlined />}
                        disabled={busyId === selectedLabel.id}
                        onClick={() => setConfirmLabelAction({ label: selectedLabel, mode: 'labelOnly' })}
                        sx={{
                          fontSize: '0.72rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(30, 41, 59, 0.15)',
                          color: 'var(--color-dominant)',
                          '&:hover': { background: 'var(--color-dominant-light)' },
                        }}
                      >
                        Remove Label
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteOutlined />}
                        disabled={busyId === selectedLabel.id}
                        onClick={() => setConfirmLabelAction({ label: selectedLabel, mode: 'trashEmails' })}
                        sx={{
                          fontSize: '0.72rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#ef4444',
                          '&:hover': { background: 'rgba(239,68,68,0.07)' },
                        }}
                      >
                        Trash + Delete
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Box>

              {/* Message List area */}
              {messagesLoading ? (
                <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', py: 6, flexDirection: 'column', gap: 2 }}>
                  <CircularProgress size={28} sx={{ color: '#f59e0b' }} />
                  <Typography variant="body2" color="text.secondary">Fetching label messages...</Typography>
                </Box>
              ) : messages && messages.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No messages found in this label.</Typography>
                </Box>
              ) : messages ? (
                <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={allSelected || false}
                            indeterminate={selectedMsgIds.size > 0 && !allSelected}
                            onChange={toggleAllMessages}
                            aria-label="Select all messages"
                          />
                        </TableCell>
                        <TableCell>From</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell align="right">Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {messages.map((m) => (
                        <TableRow
                          key={m.id}
                          hover
                          selected={selectedMsgIds.has(m.id)}
                          onClick={() => toggleMessage(m.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selectedMsgIds.has(m.id)}
                              onChange={() => toggleMessage(m.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${m.subject || '(no subject)'}`}
                            />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 180 }}>
                            <Tooltip title={m.from} placement="top-start">
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                {parseFromHeader(m.from)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {m.subject || '(no subject)'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(m.date).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}
            </Card>
          ) : (
            <Box
              sx={{
                textAlign: 'center', py: 10,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.03) 0%, transparent 100%)',
                borderRadius: 0, border: '1px dashed rgba(245,158,11,0.2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 'calc(100vh - 200px)', minHeight: 400,
              }}
            >
              <Box
                sx={{
                  width: 72, height: 72, borderRadius: '20px', mb: 2,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(245,158,11,0.2)',
                }}
              >
                <LabelOutlined sx={{ color: '#fff', fontSize: 36 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Select a Label</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', px: 2 }}>
                Pick a label from the left sidebar to view its tagged emails, clean up messages, or manage custom unsubscribe labels.
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Floating trash tray for selected messages */}
      {selectedMsgIds.size > 0 && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            color: 'common.white',
            borderRadius: '14px',
            px: 2.5,
            py: 1.25,
            zIndex: 50,
            width: 'min(560px, 92vw)',
            boxShadow: '0 12px 40px rgba(49,46,129,0.5)',
            border: '1px solid rgba(255,255,255,0.12)',
            animation: 'fadeInUp 0.3s ease-out',
          }}
          role="toolbar"
          aria-label="Actions for selected messages"
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
            <Box
              sx={{
                px: 1.25, py: 0.25, borderRadius: '8px',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                fontWeight: 800, fontSize: '0.875rem', color: '#fff',
                boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
              }}
            >
              {selectedMsgIds.size}
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              messages selected
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              disabled={trashJob.running}
              onClick={() => setConfirmTrashMsgs(true)}
              sx={{
                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                '&:hover': { background: 'linear-gradient(135deg,#dc2626,#b91c1c)' },
              }}
            >
              Move to Trash
            </Button>
            <Button
              variant="text"
              size="small"
              sx={{ color: 'rgba(255,255,255,0.45)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
              onClick={() => setSelectedMsgIds(new Set())}
            >
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

      {confirmLabelAction && (
        <ConfirmDialog
          title={
            confirmLabelAction.mode === 'labelOnly'
              ? `Remove label "${confirmLabelAction.label.name}"?`
              : `Delete "${confirmLabelAction.label.name}" and trash its emails?`
          }
          message={
            confirmLabelAction.mode === 'labelOnly'
              ? `The label will be removed from Gmail. Its ${confirmLabelAction.label.messagesTotal} emails stay in your mailbox.`
              : `This moves ${confirmLabelAction.label.messagesTotal} emails to Trash (recoverable for 30 days, then Gmail deletes them permanently) and removes the label.`
          }
          requireTypedCount={confirmLabelAction.mode === 'trashEmails' && confirmLabelAction.label.messagesTotal > 500 ? confirmLabelAction.label.messagesTotal : undefined}
          danger={confirmLabelAction.mode === 'trashEmails'}
          onCancel={() => setConfirmLabelAction(null)}
          onConfirm={executeLabelAction}
        />
      )}

      {confirmTrashMsgs && (
        <ConfirmDialog
          title={`Move ${selectedMsgIds.size.toLocaleString()} messages to Trash?`}
          message="These messages will move to Gmail Trash (recoverable for 30 days, then permanently deleted by Gmail)."
          danger
          requireTypedCount={selectedMsgIds.size > 50 ? selectedMsgIds.size : undefined}
          onCancel={() => setConfirmTrashMsgs(false)}
          onConfirm={executeTrashMessages}
        />
      )}
    </div>
  )
}
