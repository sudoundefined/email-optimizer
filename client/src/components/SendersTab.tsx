import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { MailOutlined } from '@mui/icons-material'
import { api, ApiError } from '../api'
import type { ScanResult, Suggestion, UnsubSummary, ProtectedSender } from '../types'
import { useJob } from '../hooks/useJob'
import ScanControls from './ScanControls'
import SenderTable from './SenderTable'
import UnsubscribePanel from './UnsubscribePanel'
import LabelReview from './LabelReview'
import ConfirmDialog from './ConfirmDialog'
import ProtectedTab from './ProtectedTab'

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
  const [showProtected, setShowProtected] = useState(false)
  const [protectionWarning, setProtectionWarning] = useState<string | null>(null)

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
      const nonProtected = selectedSenders.filter(s => !protectedSet.has(s.email.toLowerCase()))
      if (nonProtected.length === 0) return
      await api.protectSenders(nonProtected.map(s => s.email))
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
      const protectedSenders = selectedSenders.filter(s => protectedSet.has(s.email.toLowerCase()))
      if (protectedSenders.length === 0) return
      await api.unprotectSenders(protectedSenders.map(s => s.email))
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
    return new Set(protectedList.map(p => p.email.toLowerCase()))
  }, [protectedList])

  const selectedSenders = useMemo(
    () => (scan ? scan.senders.filter((s) => selected.has(s.email)) : []),
    [scan, selected]
  )
  const selectedUnsubscribable = selectedSenders.filter((s) => s.method !== 'none').length
  const selectedEmailCount = selectedSenders.reduce((n, s) => n + s.messageCount, 0)
  const selectedProtectedCount = useMemo(() => {
    return selectedSenders.filter(s => protectedSet.has(s.email.toLowerCase())).length
  }, [selectedSenders, protectedSet])
  const selectedNonProtectedCount = selectedSenders.length - selectedProtectedCount

  const trashProgress = trashJob.job?.progress as { trashed?: number; total?: number } | null
  const keepProgress = keepJob.job?.progress as { phase?: string; trashed?: number; total?: number; listed?: number } | null

  return (
    <div>
      <ScanControls onScan={runScan} job={scanJob.job} running={scanJob.running} scan={scan} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}
      {keepDone && <Alert severity="success" sx={{ mb: 2 }}>{keepDone}</Alert>}
      {protectionWarning && <Alert severity="warning" sx={{ mb: 2 }}>{protectionWarning}</Alert>}

      <ToggleButtonGroup
        value={showProtected ? 'protected' : 'all'}
        exclusive
        onChange={(_, val) => { if (val) setShowProtected(val === 'protected') }}
        size="small"
        sx={{ mb: 2, mt: 1 }}
      >
        <ToggleButton value="all">All Senders</ToggleButton>
        <ToggleButton value="protected">Protected ({protectedList.length})</ToggleButton>
      </ToggleButtonGroup>

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

      {!showProtected && !scan && !scanJob.running && (
        <Box sx={{ textAlign: 'center', py: 9, color: 'text.secondary' }}>
          <MailOutlined sx={{ fontSize: 56, opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" color="text.primary" gutterBottom>
            See who's filling your inbox
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>
            Scan your mailbox to group marketing email by sender, then unsubscribe, label, or trash
            them in bulk.
          </Typography>
        </Box>
      )}

      {!showProtected && scan && (
        <SenderTable
          senders={scan.senders}
          selected={selected}
          onSelectedChange={setSelected}
          suggestions={suggestionMap}
        />
      )}

      {showProtected && <ProtectedTab onDisconnected={onDisconnected} />}

      {!showProtected && selected.size > 0 && (
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
            maxWidth: 'min(92vw, 860px)',
            flexWrap: 'wrap',
          }}
          role="toolbar"
          aria-label="Actions for selected senders"
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip label={selected.size} color="primary" size="small" />
            <Typography variant="body2" sx={{ color: 'grey.400' }}>
              senders · <strong style={{ color: '#fff' }}>{selectedEmailCount.toLocaleString()}</strong> emails
              {selectedUnsubscribable < selected.size &&
                ` · ${selectedUnsubscribable} with unsubscribe support`}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="small"
              disabled={selectedUnsubscribable === 0 || unsubJob.running || trashJob.running}
              onClick={runUnsubscribe}
            >
              Unsubscribe
            </Button>
            <Button
              variant="contained"
              size="small"
              color="inherit"
              sx={{ bgcolor: 'grey.700', '&:hover': { bgcolor: 'grey.600' } }}
              disabled={unsubJob.running || trashJob.running}
              onClick={() => setShowLabelReview(true)}
            >
              Label…
            </Button>
            {selectedNonProtectedCount > 0 && (
              <Button
                variant="contained"
                size="small"
                color="inherit"
                sx={{ bgcolor: 'grey.700', '&:hover': { bgcolor: 'grey.600' } }}
                disabled={unsubJob.running || trashJob.running}
                onClick={runProtect}
              >
                Protect
              </Button>
            )}
            {selectedProtectedCount > 0 && (
              <Button
                variant="contained"
                size="small"
                color="inherit"
                sx={{ bgcolor: 'grey.700', '&:hover': { bgcolor: 'grey.600' } }}
                disabled={unsubJob.running || trashJob.running}
                onClick={runUnprotect}
              >
                Unprotect
              </Button>
            )}
            {selectedNonProtectedCount === 1 && (
              <Button
                variant="contained"
                size="small"
                color="inherit"
                sx={{ bgcolor: 'grey.700', '&:hover': { bgcolor: 'grey.600' } }}
                disabled={unsubJob.running || trashJob.running || keepJob.running}
                onClick={() => setShowKeepDialog(true)}
              >
                Keep latest…
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              color="error"
              disabled={unsubJob.running || trashJob.running}
              onClick={() => setConfirmTrash(true)}
            >
              Move to Trash
            </Button>
            <Button
              variant="text"
              size="small"
              sx={{ color: 'grey.500' }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

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
