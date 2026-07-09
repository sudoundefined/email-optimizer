import { useCallback, useEffect, useState } from 'react'
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
import { InboxOutlined as InboxIcon } from '@mui/icons-material'
import { api, ApiError } from '../api'
import type { Filter, GroupMessage, InboxGroup } from '../types'
import FilterToolbar from './FilterToolbar'
import ConfirmDialog from './ConfirmDialog'
import { useJob } from '../hooks/useJob'

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

function SelectableMessageList({
  messages,
  loading,
  emptyText,
  selected,
  onSelectedChange,
}: {
  messages: GroupMessage[] | null
  loading: boolean
  emptyText: string
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
}) {
  if (loading) return (
    <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', py: 6, flexDirection: 'column', gap: 2 }}>
      <CircularProgress size={28} sx={{ color: '#0ea5e9' }} />
      <Typography variant="body2" color="text.secondary">Loading messages…</Typography>
    </Box>
  )
  if (messages && messages.length === 0) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
    </Box>
  )
  if (!messages) return null

  const allSelected = messages.length > 0 && messages.every((m) => selected.has(m.id))
  const someSelected = messages.some((m) => selected.has(m.id))

  const toggleAll = () => {
    onSelectedChange(
      allSelected ? new Set([...selected].filter((id) => !messages.some((m) => m.id === id)))
                  : new Set([...selected, ...messages.map((m) => m.id)])
    )
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  return (
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
  )
}

export default function InboxTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [groups, setGroups] = useState<InboxGroup[] | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [messages, setMessages] = useState<GroupMessage[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null)
  const [filterResults, setFilterResults] = useState<GroupMessage[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)

  // selection state — unified across group messages and filter results
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [confirmFilterTrash, setConfirmFilterTrash] = useState(false)
  const [trashDone, setTrashDone] = useState<string | null>(null)

  const trashJob = useJob()
  const filterTrashJob = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [g, f] = await Promise.all([api.inboxGroups(), api.inboxFilters()])
        if (!cancelled) {
          setGroups(g)
          setFilters(f)
        }
      } catch (err) {
        if (!cancelled) handleApiError(err)
      }
    })()
    return () => { cancelled = true }
  }, [handleApiError])

  // clear selection when switching context
  const clearContext = () => {
    setSelected(new Set())
    setTrashDone(null)
  }

  const toggleGroup = async (key: string) => {
    if (openGroup === key) {
      setOpenGroup(null)
      setMessages(null)
      clearContext()
      return
    }
    setOpenGroup(key)
    setMessages(null)
    setMessagesLoading(true)
    setActiveFilter(null)
    setFilterResults(null)
    clearContext()
    try {
      const msgs = await api.groupMessages(key)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setOpenGroup(null)
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleFilterSelect = async (filter: Filter | null) => {
    setActiveFilter(filter)
    setFilterResults(null)
    clearContext()
    if (!filter) return
    setOpenGroup(null)
    setMessages(null)
    setFilterLoading(true)
    try {
      const msgs = await api.filterMessages(filter.query)
      setFilterResults(msgs)
    } catch (err) {
      handleApiError(err)
      setActiveFilter(null)
    } finally {
      setFilterLoading(false)
    }
  }

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setTrashDone(null)
    const ids = [...selected]
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
      setTrashDone(`Moved ${count.toLocaleString()} messages to Trash. Recoverable in Gmail for 30 days.`)
      setSelected(new Set())
      // remove trashed messages from local state
      setMessages((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
      setFilterResults((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
      
      // Update group counts if a group was open
      if (openGroup) {
        setGroups((prev) => prev ? prev.map(g => g.key === openGroup ? { ...g, count: Math.max(0, g.count - count) } : g) : prev)
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const runFilterTrash = async () => {
    if (!activeFilter) return
    setConfirmFilterTrash(false)
    setError(null)
    setTrashDone(null)
    try {
      const snapshot = await filterTrashJob.start(() => api.trashFilter(activeFilter.key))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Trash failed')
        return
      }
      const r = snapshot.result as { trashed: number; excluded?: number; capped?: boolean }
      const excludedNote =
        r.excluded && r.excluded > 0
          ? ` ${r.excluded.toLocaleString()} protected message${r.excluded === 1 ? '' : 's'} skipped.`
          : ''
      const cappedNote = r.capped ? ' Only the first 10,000 were scanned — run again to clear more.' : ''
      setTrashDone(
        `Moved ${r.trashed.toLocaleString()} message${r.trashed === 1 ? '' : 's'} matching "${activeFilter.label}" to Trash. Recoverable for 30 days.${excludedNote}${cappedNote}`
      )
      setFilterResults([])
      setSelected(new Set())
      // Group counts can overlap this filter (e.g. promotions), so refetch them.
      try {
        setGroups(await api.inboxGroups())
      } catch {
        /* keep stale counts; success alert already shown */
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const openTitle = groups?.find((g) => g.key === openGroup)?.title

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}

      {groups === null && !error && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
          <Box sx={{ animation: 'pulse 1.8s ease-in-out infinite' }}>
            <InboxIcon sx={{ fontSize: 48, color: '#0ea5e9' }} />
          </Box>
          <CircularProgress size={28} sx={{ color: '#0ea5e9' }} />
          <Typography variant="body2" color="text.secondary">Reading your inbox…</Typography>
        </Box>
      )}

      {groups && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Select a group or filter to view and clean up your inbox.
          </Typography>
        </Box>
      )}

      {groups && (
        <Grid container spacing={3}>
          {/* LEFT PANE */}
          <Grid size={{ xs: 12, md: 4.5, lg: 3.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              
              {/* Filters Card */}
              <Card sx={{
                borderRadius: 0,
                overflow: 'hidden',
                animation: 'fadeInUp 0.5s ease-out 0.1s both',
                transition: 'box-shadow 0.3s ease, transform 0.2s ease',
                '&:hover': { boxShadow: '0 8px 24px rgba(14, 165, 233, 0.12)', transform: 'translateY(-2px)' },
              }}>
                <Box sx={{ background: 'var(--card-date)', px: 2, py: 1.25 }}>
                  <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                    🔍 Smart Filters
                  </Typography>
                </Box>
                <CardContent sx={{ p: '16px !important' }}>
                  <FilterToolbar filters={filters} activeKey={activeFilter?.key ?? null} onSelect={handleFilterSelect} />
                </CardContent>
              </Card>

              {/* Newsletters & Groups Card */}
              <Card sx={{
                borderRadius: 0,
                overflow: 'hidden',
                animation: 'fadeInUp 0.5s ease-out 0.2s both',
                transition: 'box-shadow 0.3s ease, transform 0.2s ease',
                '&:hover': { boxShadow: '0 8px 24px rgba(99, 102, 241, 0.12)', transform: 'translateY(-2px)' },
              }}>
                <Box sx={{ background: 'var(--card-senders)', px: 2, py: 1.25 }}>
                  <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                    📚 Newsletters & Groups
                  </Typography>
                </Box>
                <CardContent sx={{ p: '8px !important', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
                  {groups.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No groups found.</Typography>
                  )}
                  {groups.map((g) => {
                    const active = openGroup === g.key
                    return (
                      <Box
                        key={g.key}
                        onClick={() => toggleGroup(g.key)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1,
                          py: 1,
                          mb: 0.5,
                          borderRadius: 1,
                          cursor: 'pointer',
                          bgcolor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                          borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                          '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: active ? 'var(--color-accent)' : 'text.primary' }}>
                            {g.title}
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ color: active ? 'var(--color-accent)' : 'text.secondary' }}>
                            {g.blurb}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 1, flexShrink: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: active ? 'var(--color-accent)' : 'text.primary' }}>
                            {g.approx && '≈'}{g.count.toLocaleString()}
                          </Typography>
                          {g.unread !== null && g.unread > 0 && (
                            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                              {g.unread.toLocaleString()} unread
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )
                  })}
                </CardContent>
              </Card>

            </Box>
          </Grid>

          {/* RIGHT PANE */}
          <Grid size={{ xs: 12, md: 7.5, lg: 8.5 }}>
            {(openGroup || activeFilter) ? (
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
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 3, py: 2,
                    borderBottom: '1px solid rgba(30, 41, 59, 0.06)',
                    background: 'var(--color-dominant-light)',
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {activeFilter ? activeFilter.label : openTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {activeFilter ? 'Viewing filtered messages' : 'Browse messages from this group.'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selected.size > 0 && (
                      <Chip
                        label={`${selected.size} selected`}
                        color="primary"
                        size="small"
                        onDelete={() => setSelected(new Set())}
                      />
                    )}
                    {activeFilter && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={filterTrashJob.running}
                        onClick={() => setConfirmFilterTrash(true)}
                      >
                        {filterTrashJob.running ? 'Trashing…' : 'Trash all matching'}
                      </Button>
                    )}
                    <Button size="small" variant="text" onClick={() => activeFilter ? handleFilterSelect(null) : toggleGroup(openGroup!)}>
                      Close
                    </Button>
                  </Box>
                </Box>
                <SelectableMessageList
                  messages={activeFilter ? filterResults : messages}
                  loading={activeFilter ? filterLoading : messagesLoading}
                  emptyText={activeFilter ? "No messages match this filter." : "No messages in this group."}
                  selected={selected}
                  onSelectedChange={setSelected}
                />
              </Card>
            ) : (
              <Box
                sx={{
                  textAlign: 'center', py: 10,
                  background: 'linear-gradient(135deg, rgba(14,165,233,0.03) 0%, transparent 100%)',
                  borderRadius: 0, border: '1px dashed rgba(14,165,233,0.2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 'calc(100vh - 200px)', minHeight: 400,
                }}
              >
                <Box
                  sx={{
                    width: 72, height: 72, borderRadius: '20px', mb: 2,
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(14,165,233,0.2)',
                  }}
                >
                  <InboxIcon sx={{ color: '#fff', fontSize: 36 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Select a Group</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', px: 2 }}>
                  Pick a newsletter or filter from the left sidebar to view its emails and clean up your inbox.
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      )}

      {/* Floating trash tray */}
      {selected.size > 0 && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            color: 'common.white',
            borderRadius: 0,
            px: 2.5,
            py: 1.5,
            zIndex: 50,
            maxWidth: 'min(92vw, 600px)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
            border: '1px solid rgba(255,255,255,0.10)',
            animation: 'fadeInUp 0.3s ease-out',
          }}
          role="toolbar"
          aria-label="Actions for selected messages"
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
            <Box
              sx={{
                px: 1.25, py: 0.25, borderRadius: '4px',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                fontWeight: 800, fontSize: '0.875rem', color: '#fff',
                boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
              }}
            >
              {selected.size}
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              messages selected
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              disabled={trashJob.running}
              onClick={() => setConfirmTrash(true)}
              sx={{
                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                borderRadius: 0,
                '&:hover': { background: 'linear-gradient(135deg,#dc2626,#b91c1c)' },
              }}
            >
              Move to Trash
            </Button>
            <Button
              variant="text"
              size="small"
              sx={{ color: 'rgba(255,255,255,0.45)', borderRadius: 0, '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' } }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

      {confirmTrash && (
        <ConfirmDialog
          title={`Move ${selected.size.toLocaleString()} messages to Trash?`}
          message="These messages will move to Gmail Trash (recoverable for 30 days, then permanently deleted by Gmail). This does not unsubscribe you from any senders."
          danger
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}

      {confirmFilterTrash && activeFilter && (
        <ConfirmDialog
          title={`Trash all messages matching "${activeFilter.label}"?`}
          message="This moves EVERY message matching this filter to Gmail Trash — not just the ones shown here. Recoverable for 30 days, then permanently deleted by Gmail. This does not unsubscribe you from any senders."
          danger
          onCancel={() => setConfirmFilterTrash(false)}
          onConfirm={runFilterTrash}
        />
      )}
    </div>
  )
}
