import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
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
import { api, ApiError } from '../api'
import type { StorageAttachment, StorageDrillMessage, StorageStats, StorageYear } from '../types'
import ConfirmDialog from './ConfirmDialog'
import { useJob } from '../hooks/useJob'

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

// ── Drill-down panel ─────────────────────────────────────────────────────────

interface DrillPanelProps {
  title: string
  messages: StorageDrillMessage[] | null
  loading: boolean
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onClose: () => void
}

function DrillPanel({ title, messages, loading, selected, onSelectedChange, onClose }: DrillPanelProps) {
  if (!messages && !loading) return null

  const ids = messages?.map((m) => m.id) ?? []
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
  const someSelected = ids.some((id) => selected.has(id))

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected)
      ids.forEach((id) => next.delete(id))
      onSelectedChange(next)
    } else {
      onSelectedChange(new Set([...selected, ...ids]))
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  const panelSelected = ids.filter((id) => selected.has(id)).length

  return (
    <Paper variant="outlined" sx={{ mt: 2, mb: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2">{title}</Typography>
          {messages && (
            <Chip
              label={`${messages.length} emails`}
              size="small"
              variant="outlined"
            />
          )}
          {panelSelected > 0 && (
            <Chip label={`${panelSelected} selected`} size="small" color="primary" />
          )}
        </Stack>
        <Button size="small" variant="text" onClick={onClose}>Close</Button>
      </Box>

      {/* Body */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Loading messages…</Typography>
        </Box>
      )}

      {messages && messages.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
          No messages found for this selection.
        </Typography>
      )}

      {messages && messages.length > 0 && (
        <TableContainer sx={{ maxHeight: 420, overflowY: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableCell>
                <TableCell>From</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="right">Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {messages.map((m) => (
                <TableRow
                  key={m.id}
                  hover
                  selected={selected.has(m.id)}
                  onClick={() => toggle(m.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${m.subject || '(no subject)'}`}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 160 }}>
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
                    <Typography variant="caption">{m.sizeMB.toLocaleString()} MB</Typography>
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
      )}
    </Paper>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type DrillKey = { by: 'sender'; value: string } | { by: 'month'; value: string } | { by: 'year'; value: string } | null

export default function StorageTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trashDone, setTrashDone] = useState<string | null>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)

  // drill-down state
  const [drillKey, setDrillKey] = useState<DrillKey>(null)
  const [drillMessages, setDrillMessages] = useState<StorageDrillMessage[] | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  // unified selection across attachment table + drill-down panel
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
      setStats(await api.storageStats())
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
    setDrillKey(null)
    setDrillMessages(null)
    try {
      await api.storageRefresh()
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  // Open drill-down for a sender email, month string, or year string
  const openDrill = async (by: 'sender' | 'month' | 'year', value: string) => {
    // toggle off if same key clicked again
    if (drillKey?.by === by && drillKey.value === value) {
      setDrillKey(null)
      setDrillMessages(null)
      return
    }
    setDrillKey({ by, value } as DrillKey)
    setDrillMessages(null)
    setDrillLoading(true)
    try {
      const msgs = await api.storageDrillDown(by, value)
      setDrillMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setDrillKey(null)
    } finally {
      setDrillLoading(false)
    }
  }

  const closeDrill = () => {
    setDrillKey(null)
    setDrillMessages(null)
  }

  // attachment table toggles
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
    if (allSelected) {
      const next = new Set(selectedIds)
      allIds.forEach((id) => next.delete(id))
      setSelectedIds(next)
    } else {
      setSelectedIds(new Set([...selectedIds, ...allIds]))
    }
  }

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setTrashDone(null)
    const ids = [...selectedIds]
    try {
      const response = await api.trashMessages(ids)
      if ('jobId' in response && response.jobId) {
        const snapshot = await trashJob.start(() =>
          Promise.resolve({ jobId: (response as { jobId: string }).jobId })
        )
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Move to Trash failed')
          return
        }
      }
      const count = 'trashed' in response ? response.trashed : ids.length
      setTrashDone(`Moved ${count.toLocaleString()} messages to Trash. Recoverable in Gmail for 30 days.`)
      setSelectedIds(new Set())
      // remove trashed rows from local state
      setStats((prev) =>
        prev ? { ...prev, attachments: prev.attachments.filter((a) => !ids.includes(a.id)) } : prev
      )
      setDrillMessages((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
    } catch (err) {
      handleApiError(err)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Analyzing your largest emails… this can take a moment.
      </Typography>
    )
  }

  if (error && !stats) {
    return <Alert severity="error">{error}</Alert>
  }

  if (!stats) return null

  const maxSenderMB = Math.max(1, ...stats.senders.map((s) => s.totalMB))
  const maxMonthMB = Math.max(1, ...stats.months.map((m) => m.totalMB))
  const maxYearMB = Math.max(1, ...(stats.years ?? []).map((y) => y.totalMB))
  const allAttachmentsSelected =
    stats.attachments.length > 0 && stats.attachments.every((a) => selectedIds.has(a.id))

  const drillTitle =
    drillKey?.by === 'sender'
      ? `Emails from ${parseFromHeader(
          stats.senders.find((s) => s.email === drillKey.value)?.name ?? drillKey.value
        )}`
      : drillKey?.by === 'month'
      ? `Emails from ${drillKey.value}`
      : drillKey?.by === 'year'
      ? `Emails from ${drillKey.value}`
      : ''

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Storage analysis covers every email larger than 1 MB (outside Trash and Spam). Cached for 5
          minutes. Click any sender or month bar to browse its messages.
        </Typography>
        <Button size="small" variant="outlined" onClick={refresh} sx={{ ml: 2, flexShrink: 0 }}>
          Refresh
        </Button>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 1 }}>
        {/* Reclaimable storage */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Reclaimable storage</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {stats.totalMB.toLocaleString()} MB
              </Typography>
              <Typography variant="body2" color="text.secondary">
                across {stats.messageCount.toLocaleString()} large emails
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Top senders — each row is clickable */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Top senders by size</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Click a row to browse its messages
              </Typography>
              {stats.senders.length === 0 && (
                <Typography variant="body2" color="text.secondary">No large emails found.</Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                {stats.senders.map((s) => {
                  const active = drillKey?.by === 'sender' && drillKey.value === s.email
                  return (
                    <Box
                      key={s.email}
                      onClick={() => openDrill('sender', s.email)}
                      title={`${s.email} — ${s.messageCount} emails — click to browse`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 0.75,
                        py: 0.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: active ? 'action.selected' : 'transparent',
                        border: active ? 1 : 0,
                        borderColor: 'primary.main',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background-color 150ms ease',
                      }}
                    >
                      <Typography variant="caption" noWrap sx={{ minWidth: 90, maxWidth: 90 }}>
                        {parseFromHeader(s.name)}
                      </Typography>
                      <Box
                        sx={{
                          height: 16,
                          bgcolor: active ? 'primary.main' : 'primary.light',
                          borderRadius: 1,
                          width: `${Math.max(4, (s.totalMB / maxSenderMB) * 120)}px`,
                          flexShrink: 0,
                          transition: 'width 200ms ease, background-color 150ms ease',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {s.totalMB.toLocaleString()} MB
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Storage by month — each row is clickable */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Storage by month</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Click a row to browse its messages
              </Typography>
              {stats.months.length === 0 && (
                <Typography variant="body2" color="text.secondary">No large emails found.</Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                {stats.months.map((m) => {
                  const active = drillKey?.by === 'month' && drillKey.value === m.month
                  return (
                    <Box
                      key={m.month}
                      onClick={() => openDrill('month', m.month)}
                      title={`${m.messageCount} emails — click to browse`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 0.75,
                        py: 0.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: active ? 'action.selected' : 'transparent',
                        border: active ? 1 : 0,
                        borderColor: 'primary.main',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background-color 150ms ease',
                      }}
                    >
                      <Typography variant="caption" noWrap sx={{ minWidth: 90, maxWidth: 90 }}>
                        {m.month}
                      </Typography>
                      <Box
                        sx={{
                          height: 16,
                          bgcolor: active ? 'primary.main' : 'primary.light',
                          borderRadius: 1,
                          width: `${Math.max(4, (m.totalMB / maxMonthMB) * 120)}px`,
                          flexShrink: 0,
                          transition: 'width 200ms ease, background-color 150ms ease',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {m.totalMB.toLocaleString()} MB
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Storage by year — each row is clickable */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Storage by year</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Click a row to browse its messages
              </Typography>
              {(stats.years ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">No large emails found.</Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                {(stats.years ?? []).map((y: StorageYear) => {
                  const active = drillKey?.by === 'year' && drillKey.value === y.year
                  return (
                    <Box
                      key={y.year}
                      onClick={() => openDrill('year', y.year)}
                      title={`${y.messageCount} emails — click to browse`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 0.75,
                        py: 0.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: active ? 'action.selected' : 'transparent',
                        border: active ? 1 : 0,
                        borderColor: 'primary.main',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background-color 150ms ease',
                      }}
                    >
                      <Typography variant="caption" noWrap sx={{ minWidth: 90, maxWidth: 90 }}>
                        {y.year}
                      </Typography>
                      <Box
                        sx={{
                          height: 16,
                          bgcolor: active ? 'primary.main' : 'primary.light',
                          borderRadius: 1,
                          width: `${Math.max(4, (y.totalMB / maxYearMB) * 120)}px`,
                          flexShrink: 0,
                          transition: 'width 200ms ease, background-color 150ms ease',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {y.totalMB.toLocaleString()} MB · {y.messageCount} emails
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Drill-down panel — appears below the cards when a sender/month is selected */}
      {drillKey && (
        <DrillPanel
          title={drillTitle}
          messages={drillMessages}
          loading={drillLoading}
          selected={selectedIds}
          onSelectedChange={setSelectedIds}
          onClose={closeDrill}
        />
      )}

      {drillKey && <Divider sx={{ mb: 3 }} />}

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

      {/* Floating trash tray — appears when anything is selected */}
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
              messages selected
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
          message="These messages will move to Gmail Trash, recoverable for 30 days. Nothing is permanently deleted."
          danger
          requireTypedCount={selectedIds.size > 50 ? selectedIds.size : undefined}
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}
    </div>
  )
}
