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
import StorageOutlined from '@mui/icons-material/StorageOutlined'
import { api, ApiError } from '../api'
import type { StorageAttachment, StorageDrillMessage, StorageStats, StorageYear, StorageSizeBand } from '../types'
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
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
              border: '1px solid rgba(30, 41, 59, 0.1)',
        borderRadius: 0,
        overflow: 'hidden',
        animation: 'fadeInUp 0.4s ease-out',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          background: 'var(--color-dominant-light)',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h6">{title}</Typography>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 3 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading messages…</Typography>
        </Box>
      )}

      {messages && messages.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 3 }}>
          No messages found for this selection.
        </Typography>
      )}

      {messages && messages.length > 0 && (
        <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
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

type DrillKey = { by: 'sender'; value: string } | { by: 'month'; value: string } | { by: 'year'; value: string } | { by: 'size'; value: string } | null

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

  // year-expand state for the left-pane date filter
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  // group months by year for dependent filtering
  const monthsByYear = useMemo(() => {
    if (!stats) return {}
    const groups: Record<string, typeof stats.months> = {}
    for (const m of stats.months) {
      const year = m.month.split('-')[0]
      if (!groups[year]) groups[year] = []
      groups[year].push(m)
    }
    return groups
  }, [stats])

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
  const openDrill = async (by: 'sender' | 'month' | 'year' | 'size', value: string) => {
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          gap: 2,
        }}
      >
        <Box
          sx={{
            animation: 'pulse 1.8s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.5, transform: 'scale(0.92)' },
            },
          }}
        >
          <StorageOutlined sx={{ fontSize: 48, color: '#10b981' }} />
        </Box>
        <CircularProgress size={28} sx={{ color: '#10b981' }} />
        <Typography variant="body2" color="text.secondary">
          Analyzing your largest emails… this can take a moment.
        </Typography>
      </Box>
    )
  }

  if (error && !stats) {
    return <Alert severity="error">{error}</Alert>
  }

  if (!stats) return null

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
      : drillKey?.by === 'size'
      ? `Emails sized ${(stats.sizes ?? []).find(s => s.key === drillKey.value)?.label ?? drillKey.value}`
      : ''

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Storage analysis covers every email larger than 500 KB (outside Trash and Spam). Cached for 5
          minutes. Click any category to browse its messages.
        </Typography>
        <Button size="small" variant="outlined" onClick={refresh} sx={{ ml: 2, flexShrink: 0 }}>
          Refresh
        </Button>
      </Box>

      {/* Reclaimable storage hero card */}
      <Card
        sx={{
          background: 'var(--card-hero)',
          color: '#fff',
          mb: 3,
          position: 'relative',
          overflow: 'hidden',
          animation: 'fadeInUp 0.5s ease-out, pulseGlow 4s ease-in-out infinite',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.08), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
            pointerEvents: 'none',
          },
        }}
      >
        <CardContent sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>
                Reclaimable storage
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 700, color: '#fff' }}>
                {stats.totalMB.toLocaleString()} MB
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                across {stats.messageCount.toLocaleString()} large emails
              </Typography>
            </Box>
            <Box sx={{
              width: 56, height: 56, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
            }}>
              <StorageOutlined sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* LEFT PANE — Navigation */}
        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            
            {/* Storage by Year -> Month */}
            <Card sx={{
              borderRadius: 0,
              overflow: 'hidden',
              animation: 'fadeInUp 0.5s ease-out 0.1s both',
              transition: 'box-shadow 0.3s ease, transform 0.2s ease',
              '&:hover': { boxShadow: '0 8px 24px rgba(14, 165, 233, 0.12)', transform: 'translateY(-2px)' },
            }}>
              <Box sx={{ background: 'var(--card-date)', px: 2, py: 1.25 }}>
                <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                  📅 Storage by date
                </Typography>
              </Box>
              <CardContent sx={{ p: '8px !important' }}>
                {(stats.years ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No large emails found.</Typography>
                )}
                {(stats.years ?? []).map((y: StorageYear) => {
                  const isExpanded = expandedYears.has(y.year)
                  return (
                    <Box key={y.year}>
                      {/* Year Row */}
                      <Box
                        onClick={() => toggleYear(y.year)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1,
                          py: 1,
                          borderRadius: 1,
                          cursor: 'pointer',
                          bgcolor: isExpanded ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.08)' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{y.year}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {y.totalMB.toLocaleString()} MB
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            {isExpanded ? '▲' : '▼'}
                          </Typography>
                        </Box>
                      </Box>
                      {/* Nested Months */}
                      {isExpanded && (monthsByYear[y.year] || []).map((m) => {
                        const active = drillKey?.by === 'month' && drillKey.value === m.month
                        return (
                          <Box
                            key={m.month}
                            onClick={() => openDrill('month', m.month)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              pl: 3,
                              pr: 1,
                              py: 0.75,
                              borderRadius: 1,
                              cursor: 'pointer',
                              bgcolor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                              borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                              '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                            }}
                          >
                            <Typography variant="body2" sx={{ color: active ? 'var(--color-accent)' : 'text.primary' }}>
                              {new Date(Number(m.month.split('-')[0]), Number(m.month.split('-')[1]) - 1).toLocaleString('default', { month: 'long' })}
                            </Typography>
                            <Typography variant="caption" sx={{ color: active ? 'var(--color-accent)' : 'text.secondary' }}>
                              {m.totalMB.toLocaleString()} MB
                            </Typography>
                          </Box>
                        )
                      })}
                    </Box>
                  )
                })}
              </CardContent>
            </Card>

            {/* Top Senders */}
            <Card sx={{
              borderRadius: 0,
              overflow: 'hidden',
              animation: 'fadeInUp 0.5s ease-out 0.2s both',
              transition: 'box-shadow 0.3s ease, transform 0.2s ease',
              '&:hover': { boxShadow: '0 8px 24px rgba(139, 92, 246, 0.12)', transform: 'translateY(-2px)' },
            }}>
              <Box sx={{ background: 'var(--card-senders)', px: 2, py: 1.25 }}>
                <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                  👤 Top Senders
                </Typography>
              </Box>
              <CardContent sx={{ p: '8px !important' }}>
                {stats.senders.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No large emails found.</Typography>
                )}
                {stats.senders.map((s) => {
                  const active = drillKey?.by === 'sender' && drillKey.value === s.email
                  return (
                    <Box
                      key={s.email}
                      onClick={() => openDrill('sender', s.email)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1,
                        py: 0.75,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                        '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                      }}
                    >
                      <Typography variant="body2" noWrap sx={{ maxWidth: 140, color: active ? 'var(--color-accent)' : 'text.primary' }}>
                        {parseFromHeader(s.name)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: active ? 'var(--color-accent)' : 'text.secondary' }}>
                        {s.totalMB.toLocaleString()} MB
                      </Typography>
                    </Box>
                  )
                })}
              </CardContent>
            </Card>

            {/* Size Bands */}
            <Card sx={{
              borderRadius: 0,
              overflow: 'hidden',
              animation: 'fadeInUp 0.5s ease-out 0.3s both',
              transition: 'box-shadow 0.3s ease, transform 0.2s ease',
              '&:hover': { boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)', transform: 'translateY(-2px)' },
            }}>
              <Box sx={{ background: 'var(--card-size)', px: 2, py: 1.25 }}>
                <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                  📦 By Size
                </Typography>
              </Box>
              <CardContent sx={{ p: '8px !important' }}>
                {(stats.sizes ?? []).every(s => s.messageCount === 0) && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No large emails found.</Typography>
                )}
                {(stats.sizes ?? []).map((s: StorageSizeBand) => {
                  const active = drillKey?.by === 'size' && drillKey.value === s.key
                  const disabled = s.messageCount === 0
                  return (
                    <Box
                      key={s.key}
                      onClick={() => !disabled && openDrill('size', s.key)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1,
                        py: 0.75,
                        borderRadius: 1,
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                        bgcolor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                        '&:hover': disabled ? {} : { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                      }}
                    >
                      <Typography variant="body2" sx={{ color: active ? 'var(--color-accent)' : 'text.primary' }}>
                        {s.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: active ? 'var(--color-accent)' : 'text.secondary' }}>
                        {disabled ? '0 emails' : `${s.totalMB.toLocaleString()} MB`}
                      </Typography>
                    </Box>
                  )
                })}
              </CardContent>
            </Card>

          </Box>
        </Grid>

        {/* RIGHT PANE — Content */}
        <Grid size={{ xs: 12, md: 8, lg: 9 }}>
          {drillKey ? (
            <Box sx={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
              <DrillPanel
                title={drillTitle}
                messages={drillMessages}
                loading={drillLoading}
                selected={selectedIds}
                onSelectedChange={setSelectedIds}
                onClose={closeDrill}
              />
            </Box>
          ) : (
            <Card
              variant="outlined"
              sx={{
                border: '1px solid rgba(30, 41, 59, 0.1)',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 200px)',
                minHeight: 400,
                animation: 'fadeInUp 0.5s ease-out 0.15s both',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Box sx={{ p: 3, borderBottom: '1px solid rgba(30, 41, 59, 0.06)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Default view showing all massive attachments across your mailbox.
                </Typography>
              </Box>

              {stats.attachments.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography variant="body2" color="text.secondary">No attachments larger than 5 MB found.</Typography>
                </Box>
              ) : (
                <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                  <Table size="small" stickyHeader>
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
                          <TableCell sx={{ maxWidth: 160 }}>
                            <Tooltip title={a.from} placement="top-start">
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                {parseFromHeader(a.from)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {a.subject || '(no subject)'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{a.sizeMB.toLocaleString()} MB</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
            </Card>
          )}
        </Grid>
      </Grid>

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
            background: 'var(--color-dominant)',
            color: 'common.white',
            borderRadius: 0,
            px: 2.5,
            py: 1.5,
            zIndex: 50,
            maxWidth: 'min(92vw, 600px)',
            border: '1px solid rgba(15, 23, 42, 0.15)',
          }}
          role="toolbar"
          aria-label="Actions for selected messages"
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
            <Chip label={selectedIds.size} color="primary" size="small" />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              messages selected
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              color="error"
              disabled={trashJob.running}
              onClick={() => setConfirmTrash(true)}
              sx={{
                background: 'var(--color-accent)',
                '&:hover': { background: 'var(--color-dominant)' },
              }}
            >
              Move to Trash
            </Button>
            <Button
              variant="text"
              size="small"
              sx={{ color: 'rgba(255,255,255,0.5)' }}
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
