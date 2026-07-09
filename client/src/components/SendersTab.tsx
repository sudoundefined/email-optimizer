import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { MailOutlined, SearchOutlined } from '@mui/icons-material'
import { api, ApiError } from '../api'
import type { ScanResult, Sender, Suggestion, UnsubSummary, ProtectedSender } from '../types'
import { useJob } from '../hooks/useJob'
import ScanControls from './ScanControls'
import SenderTable, { CATEGORY_COLORS } from './SenderTable'
import UnsubscribePanel from './UnsubscribePanel'
import LabelReview from './LabelReview'
import ConfirmDialog from './ConfirmDialog'
import ProtectedTab from './ProtectedTab'

type Segment = 'all' | 'unsub' | 'nomethod' | 'protected'
type SortKey = 'volume' | 'name' | 'recent'

const SEGMENTS: { key: Segment; label: string; blurb: string }[] = [
  { key: 'all', label: 'All senders', blurb: 'Everything from your scan' },
  { key: 'unsub', label: 'With unsubscribe', blurb: 'One-click, email, or link' },
  { key: 'nomethod', label: 'No method', blurb: 'No unsubscribe detected' },
  { key: 'protected', label: 'Protected list', blurb: 'Shielded from bulk actions' },
]

export default function SendersTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [unsubSummary, setUnsubSummary] = useState<UnsubSummary | null>(null)
  const [showLabelReview, setShowLabelReview] = useState(false)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [trashDone, setTrashDone] = useState<string | null>(null)
  const [keepDone, setKeepDone] = useState<string | null>(null)
  const [showKeepDialog, setShowKeepDialog] = useState(false)
  const [keepN, setKeepN] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [protectedList, setProtectedList] = useState<ProtectedSender[]>([])
  const [protectionWarning, setProtectionWarning] = useState<string | null>(null)

  // redesign: filter/sort/search state driving the two-pane view
  const [segment, setSegment] = useState<Segment>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('volume')

  const scanJob = useJob()
  const unsubJob = useJob()
  const trashJob = useJob()
  const keepJob = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const loadSenders = useCallback(async () => {
    try {
      const result = await api.senders()
      setScan(result)
      setSuggestions(await api.suggestions())
      const protectedRes = await api.protectedList()
      setProtectedList(protectedRes.protected)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) return
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    loadSenders()
  }, [loadSenders])

  const runScan = async (range: string) => {
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setKeepDone(null)
    setSelected(new Set())
    try {
      const snapshot = await scanJob.start(() => api.startScan(range))
      if (snapshot.state === 'error') setError(snapshot.error || 'Scan failed')
      else await loadSenders()
    } catch (err) {
      handleApiError(err)
    }
  }

  const runUnsubscribe = async () => {
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setKeepDone(null)
    setProtectionWarning(null)
    try {
      const emails = [...selected]
      const response = await api.startUnsubscribe(emails)

      if (response.excluded > 0) {
        setProtectionWarning(
          `${response.excluded} protected sender${response.excluded > 1 ? 's' : ''} excluded from this action.`
        )
      }

      if (!response.jobId) {
        setError('All selected senders are protected')
        return
      }

      const snapshot = await unsubJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') setError(snapshot.error || 'Unsubscribe failed')
      else setUnsubSummary(snapshot.result as UnsubSummary)
    } catch (err) {
      handleApiError(err)
    }
  }

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setKeepDone(null)
    setProtectionWarning(null)
    try {
      const emails = [...selected]
      const response = await api.trashSenders(emails)

      if (response.excluded > 0) {
        setProtectionWarning(
          `${response.excluded} protected sender${response.excluded > 1 ? 's' : ''} excluded from this action.`
        )
      }

      if (!response.jobId) {
        setError('All selected senders are protected')
        return
      }

      const snapshot = await trashJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Moving to Trash failed')
      } else {
        const result = snapshot.result as { trashed: number; senders: number }
        setTrashDone(
          `Moved ${result.trashed.toLocaleString()} emails from ${result.senders} senders to Trash. They stay recoverable in Gmail Trash for 30 days.`
        )
        setSelected(new Set())
        await loadSenders()
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const runKeepLatest = async () => {
    setShowKeepDialog(false)
    setError(null)
    setKeepDone(null)
    setTrashDone(null)
    setUnsubSummary(null)
    setProtectionWarning(null)
    const target = selectedSenders.find((s) => !protectedSet.has(s.email.toLowerCase()))
    if (!target) return
    try {
      const response = await api.keepLatest(target.email, keepN)
      if (response.protected || !response.jobId) {
        setProtectionWarning('That sender is protected and was skipped.')
        return
      }
      const snapshot = await keepJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Keep-latest failed')
      } else {
        const r = snapshot.result as { trashed: number; kept: number; capped?: boolean }
        setKeepDone(
          `Kept the ${r.kept} newest email${r.kept === 1 ? '' : 's'} from ${target.name || target.email} and moved ${r.trashed.toLocaleString()} older one${r.trashed === 1 ? '' : 's'} to Trash (recoverable 30 days).${r.capped ? ' Note: only the 10,000 most recent were scanned — run again to trash more.' : ''}`
        )
        setSelected(new Set())
        await loadSenders()
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const runProtect = async () => {
    setError(null)
    setProtectionWarning(null)
    try {
      const nonProtected = selectedSenders.filter((s) => !protectedSet.has(s.email.toLowerCase()))
      if (nonProtected.length === 0) return
      await api.protectSenders(nonProtected.map((s) => s.email))
      await loadSenders()
      setSelected(new Set())
    } catch (err) {
      handleApiError(err)
    }
  }

  const runUnprotect = async () => {
    setError(null)
    setProtectionWarning(null)
    try {
      const protectedSenders = selectedSenders.filter((s) => protectedSet.has(s.email.toLowerCase()))
      if (protectedSenders.length === 0) return
      await api.unprotectSenders(protectedSenders.map((s) => s.email))
      await loadSenders()
      setSelected(new Set())
    } catch (err) {
      handleApiError(err)
    }
  }

  const suggestionMap = useMemo(() => {
    const m = new Map<string, Suggestion>()
    for (const s of suggestions || []) m.set(s.senderEmail, s)
    return m
  }, [suggestions])

  const protectedSet = useMemo(() => {
    return new Set(protectedList.map((p) => p.email.toLowerCase()))
  }, [protectedList])

  const selectedSenders = useMemo(
    () => (scan ? scan.senders.filter((s) => selected.has(s.email)) : []),
    [scan, selected]
  )
  const selectedUnsubscribable = selectedSenders.filter((s) => s.method !== 'none').length
  const selectedEmailCount = selectedSenders.reduce((n, s) => n + s.messageCount, 0)
  const selectedProtectedCount = useMemo(() => {
    return selectedSenders.filter((s) => protectedSet.has(s.email.toLowerCase())).length
  }, [selectedSenders, protectedSet])
  const selectedNonProtectedCount = selectedSenders.length - selectedProtectedCount

  const trashProgress = trashJob.job?.progress as { trashed?: number; total?: number } | null
  const keepProgress = keepJob.job?.progress as { phase?: string; trashed?: number; total?: number; listed?: number } | null

  // ── Segment counts (left pane) ─────────────────────────────────────────────
  const segmentCounts = useMemo(() => {
    const all = scan?.senders ?? []
    return {
      all: all.length,
      unsub: all.filter((s) => s.method !== 'none').length,
      nomethod: all.filter((s) => s.method === 'none').length,
      protected: protectedList.length,
    }
  }, [scan, protectedList])

  // ── Category counts (left pane) ────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scan?.senders ?? []) {
      const c = suggestionMap.get(s.email)?.category
      if (c) m.set(c, (m.get(c) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [scan, suggestionMap])

  // ── Filtered + sorted senders (right pane) ─────────────────────────────────
  const visibleSenders = useMemo(() => {
    if (!scan) return []
    let list: Sender[] = scan.senders
    if (segment === 'unsub') list = list.filter((s) => s.method !== 'none')
    else if (segment === 'nomethod') list = list.filter((s) => s.method === 'none')
    if (category) list = list.filter((s) => suggestionMap.get(s.email)?.category === category)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.latestSubject || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...list]
    if (sort === 'volume') sorted.sort((a, b) => b.messageCount - a.messageCount)
    else if (sort === 'name') sorted.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
    else if (sort === 'recent') sorted.sort((a, b) => b.latestDate - a.latestDate)
    return sorted
  }, [scan, segment, category, search, sort, suggestionMap])

  const showProtectedView = segment === 'protected'
  const rightTitle = SEGMENTS.find((s) => s.key === segment)?.label ?? 'Senders'

  const paneHeight = 'calc(100vh - 300px)'

  return (
    <div>
      <ScanControls onScan={runScan} job={scanJob.job} running={scanJob.running} scan={scan} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}
      {keepDone && <Alert severity="success" sx={{ mb: 2 }}>{keepDone}</Alert>}
      {protectionWarning && <Alert severity="warning" sx={{ mb: 2 }}>{protectionWarning}</Alert>}

      {trashJob.running && trashProgress && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Moving to Trash… {trashProgress.trashed ?? 0} / {trashProgress.total ?? '?'} emails
          </Typography>
          <LinearProgress sx={{ mt: 0.5 }} />
        </Box>
      )}

      {keepJob.running && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {keepProgress?.phase === 'trashing'
              ? `Keeping latest, trashing older… ${keepProgress.trashed ?? 0} / ${keepProgress.total ?? '?'} emails`
              : `Scanning sender history… ${keepProgress?.listed ?? 0} found`}
          </Typography>
          <LinearProgress sx={{ mt: 0.5 }} />
        </Box>
      )}

      {unsubJob.running && unsubJob.job?.progress != null && (
        <UnsubscribePanel progress={unsubJob.job.progress as never} running />
      )}
      {unsubSummary && <UnsubscribePanel summary={unsubSummary} />}

      {!scan && !scanJob.running && (
        <Box sx={{ textAlign: 'center', py: 9, color: 'text.secondary' }}>
          <MailOutlined sx={{ fontSize: 56, opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" color="text.primary" gutterBottom>
            See who's filling your inbox
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>
            Scan your mailbox to group marketing email by sender, then unsubscribe, label, protect,
            or trash them in bulk.
          </Typography>
        </Box>
      )}

      {scan && (
        <Grid container spacing={3}>
          {/* ── LEFT PANE — filters ── */}
          <Grid size={{ xs: 12, md: 4, lg: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Search */}
              <Card sx={{ borderRadius: 0, animation: 'fadeInUp 0.5s ease-out 0.05s both' }}>
                <CardContent sx={{ p: '12px !important' }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search senders…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </CardContent>
              </Card>

              {/* Segments */}
              <Card sx={{
                borderRadius: 0, overflow: 'hidden',
                animation: 'fadeInUp 0.5s ease-out 0.1s both',
                transition: 'box-shadow 0.3s ease, transform 0.2s ease',
                '&:hover': { boxShadow: '0 8px 24px rgba(139, 92, 246, 0.12)', transform: 'translateY(-2px)' },
              }}>
                <Box sx={{ background: 'var(--card-senders)', px: 2, py: 1.25 }}>
                  <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                    🗂 Segments
                  </Typography>
                </Box>
                <CardContent sx={{ p: '8px !important' }}>
                  {SEGMENTS.map((seg) => {
                    const active = segment === seg.key
                    const count = segmentCounts[seg.key]
                    return (
                      <Box
                        key={seg.key}
                        onClick={() => { setSegment(seg.key); if (seg.key === 'protected') setCategory(null) }}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          px: 1, py: 1, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                          bgcolor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                          borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                          '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                        }}
                      >
                        <Box sx={{ overflow: 'hidden' }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: active ? 'var(--color-accent)' : 'text.primary' }}>
                            {seg.label}
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ color: active ? 'var(--color-accent)' : 'text.secondary' }}>
                            {seg.blurb}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, ml: 1, flexShrink: 0, color: active ? 'var(--color-accent)' : 'text.primary' }}>
                          {count.toLocaleString()}
                        </Typography>
                      </Box>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Categories */}
              {!showProtectedView && categoryCounts.length > 0 && (
                <Card sx={{
                  borderRadius: 0, overflow: 'hidden',
                  animation: 'fadeInUp 0.5s ease-out 0.15s both',
                  transition: 'box-shadow 0.3s ease, transform 0.2s ease',
                  '&:hover': { boxShadow: '0 8px 24px rgba(14, 165, 233, 0.12)', transform: 'translateY(-2px)' },
                }}>
                  <Box sx={{ background: 'var(--card-date)', px: 2, py: 1.25 }}>
                    <Typography variant="overline" sx={{ color: '#fff', display: 'block', lineHeight: 1.4 }}>
                      🏷 Categories
                    </Typography>
                  </Box>
                  <CardContent sx={{ p: '8px !important' }}>
                    <Box
                      onClick={() => setCategory(null)}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        px: 1, py: 0.75, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                        bgcolor: category === null ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, color: category === null ? 'var(--color-accent)' : 'text.primary' }}>
                        All categories
                      </Typography>
                    </Box>
                    {categoryCounts.map(([cat, count]) => {
                      const active = category === cat
                      const color = CATEGORY_COLORS[cat] ?? '#94a3b8'
                      return (
                        <Box
                          key={cat}
                          onClick={() => setCategory(active ? null : cat)}
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: 1, py: 0.75, mb: 0.25, borderRadius: 1, cursor: 'pointer',
                            bgcolor: active ? `${color}14` : 'transparent',
                            borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
                            '&:hover': { bgcolor: `${color}14` },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ color: active ? color : 'text.primary' }}>{cat}</Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: active ? color : 'text.secondary', fontWeight: 600 }}>
                            {count.toLocaleString()}
                          </Typography>
                        </Box>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </Box>
          </Grid>

          {/* ── RIGHT PANE — content ── */}
          <Grid size={{ xs: 12, md: 8, lg: 9 }}>
            {showProtectedView ? (
              <Card
                variant="outlined"
                sx={{
                  border: '1px solid rgba(30, 41, 59, 0.1)', borderRadius: 0,
                  display: 'flex', flexDirection: 'column', height: paneHeight, minHeight: 400,
                  animation: 'fadeInUp 0.4s ease-out', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                }}
              >
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(30, 41, 59, 0.06)', background: 'var(--color-dominant-light)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Protected list</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Senders shielded from bulk unsubscribe and trash. Banks, utilities, and government are auto-protected.
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
                  <ProtectedTab onDisconnected={onDisconnected} />
                </Box>
              </Card>
            ) : (
              <Card
                variant="outlined"
                sx={{
                  border: '1px solid rgba(30, 41, 59, 0.1)', borderRadius: 0,
                  display: 'flex', flexDirection: 'column', height: paneHeight, minHeight: 400,
                  animation: 'fadeInUp 0.4s ease-out', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                }}
              >
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                  px: 3, py: 2, borderBottom: '1px solid rgba(30, 41, 59, 0.06)', background: 'var(--color-dominant-light)',
                }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>{rightTitle}</Typography>
                      <Chip label={`${visibleSenders.length.toLocaleString()}`} size="small" variant="outlined" />
                      {category && (
                        <Chip
                          label={category}
                          size="small"
                          onDelete={() => setCategory(null)}
                          sx={{ background: `${CATEGORY_COLORS[category] ?? '#94a3b8'}18`, color: CATEGORY_COLORS[category] ?? '#64748b' }}
                        />
                      )}
                      {selected.size > 0 && (
                        <Chip label={`${selected.size} selected`} size="small" color="primary" onDelete={() => setSelected(new Set())} />
                      )}
                    </Stack>
                  </Box>
                  <Select
                    size="small"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    sx={{ minWidth: 150, flexShrink: 0 }}
                  >
                    <MenuItem value="volume">Sort: Most emails</MenuItem>
                    <MenuItem value="name">Sort: Name (A–Z)</MenuItem>
                    <MenuItem value="recent">Sort: Most recent</MenuItem>
                  </Select>
                </Box>
                <SenderTable
                  senders={visibleSenders}
                  selected={selected}
                  onSelectedChange={setSelected}
                  suggestions={suggestionMap}
                  protectedSet={protectedSet}
                />
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* ── Floating action tray ── */}
      {!showProtectedView && selected.size > 0 && (() => {
        const busy = unsubJob.running || trashJob.running || keepJob.running
        return (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
            // Fixed width + space-between keeps the bar perfectly centered and the
            // action group pinned to the right edge, so it never slides sideways as
            // the button set or the counts change.
            width: 'min(980px, 94vw)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, overflow: 'hidden',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            color: 'common.white', borderRadius: '14px', px: 2.5, py: 1.25, zIndex: 50,
            boxShadow: '0 12px 40px rgba(49, 46, 129, 0.5)', border: '1px solid rgba(255,255,255,0.12)',
            animation: 'fadeInUp 0.3s ease-out',
          }}
          role="toolbar"
          aria-label="Actions for selected senders"
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Box sx={{
              minWidth: 28, height: 28, px: 1, borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontWeight: 800, fontSize: '0.85rem', color: '#fff',
            }}>
              {selected.size}
            </Box>
            <Typography variant="body2" noWrap sx={{ color: 'rgba(255,255,255,0.75)' }}>
              senders · <strong style={{ color: '#fff' }}>{selectedEmailCount.toLocaleString()}</strong> emails
              {selectedUnsubscribable < selected.size && ` · ${selectedUnsubscribable} unsub-able`}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, overflowX: 'auto', py: 0.25, '& > *': { flexShrink: 0 } }}>
            <Button
              variant="contained" size="small"
              disabled={selectedUnsubscribable === 0 || busy}
              onClick={runUnsubscribe}
            >
              Unsubscribe
            </Button>
            <Button
              variant="contained" size="small" color="inherit"
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', whiteSpace: 'nowrap', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              disabled={busy}
              onClick={() => setShowLabelReview(true)}
            >
              Label…
            </Button>
            <Button
              variant="contained" size="small" color="inherit"
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              disabled={selectedNonProtectedCount === 0 || busy}
              onClick={runProtect}
            >
              Protect
            </Button>
            <Button
              variant="contained" size="small" color="inherit"
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              disabled={selectedProtectedCount === 0 || busy}
              onClick={runUnprotect}
            >
              Unprotect
            </Button>
            <Button
              variant="contained" size="small" color="inherit"
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', whiteSpace: 'nowrap', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              disabled={selectedNonProtectedCount !== 1 || busy}
              onClick={() => setShowKeepDialog(true)}
            >
              Keep latest…
            </Button>
            <Button
              variant="contained" size="small"
              sx={{ whiteSpace: 'nowrap', background: 'linear-gradient(135deg,#ef4444,#dc2626)', '&:hover': { background: 'linear-gradient(135deg,#dc2626,#b91c1c)' } }}
              disabled={busy}
              onClick={() => setConfirmTrash(true)}
            >
              Move to Trash
            </Button>
            <Button
              variant="text" size="small"
              sx={{ color: 'rgba(255,255,255,0.55)', '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' } }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </Stack>
        </Paper>
        )
      })()}

      {showLabelReview && scan && (
        <LabelReview
          senders={selectedSenders}
          suggestions={suggestionMap}
          onClose={() => setShowLabelReview(false)}
          onDisconnected={onDisconnected}
        />
      )}

      {showKeepDialog && (() => {
        const target = selectedSenders.find((s) => !protectedSet.has(s.email.toLowerCase()))
        return (
          <Dialog open onClose={() => setShowKeepDialog(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Keep latest emails</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Keep the newest emails from{' '}
                <strong>{target?.name || target?.email}</strong> and move all older ones to
                Trash (recoverable for 30 days). This does not unsubscribe you.
              </Typography>
              <TextField
                type="number"
                size="small"
                label="Emails to keep"
                value={keepN}
                onChange={(e) => setKeepN(Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1))))}
                slotProps={{ htmlInput: { min: 1, max: 1000, step: 1 } }}
                autoFocus
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowKeepDialog(false)}>Cancel</Button>
              <Button variant="contained" color="error" onClick={runKeepLatest}>
                Keep {keepN}, trash the rest
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {confirmTrash && (
        <ConfirmDialog
          title={`Move ${selectedEmailCount.toLocaleString()} emails to Trash?`}
          message={`Every scanned email from the ${selected.size} selected senders goes to Gmail Trash. Trash is recoverable for 30 days, then Gmail deletes it permanently. This does not unsubscribe you — new emails will still arrive.`}
          danger
          requireTypedCount={selectedEmailCount > 500 ? selectedEmailCount : undefined}
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}
    </div>
  )
}
