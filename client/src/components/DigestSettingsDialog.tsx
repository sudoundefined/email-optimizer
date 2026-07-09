import { useCallback, useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { api, ApiError } from '../api'
import type { DigestState, DigestRunResult } from '../types'
import { useJob } from '../hooks/useJob'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtDate(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function DigestSettingsDialog({
  open,
  onClose,
  onDisconnected,
  accountEmail,
}: {
  open: boolean
  onClose: () => void
  onDisconnected: () => void
  accountEmail: string
}) {
  const [state, setState] = useState<DigestState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<DigestRunResult | null>(null)
  const job = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      setState(await api.digest())
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    if (open) {
      setNotice(null)
      setPreview(null)
      load()
    }
  }, [open, load])

  const patch = (p: Partial<DigestState['settings']>) =>
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...p } } : prev))

  const save = async () => {
    if (!state) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const { settings } = await api.saveDigestSettings(state.settings)
      setState((prev) => (prev ? { ...prev, settings } : prev))
      setNotice('Settings saved.')
    } catch (err) {
      handleApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    setError(null)
    setNotice(null)
    setPreview(null)
    try {
      const snap = await job.start(() => api.previewDigest())
      if (snap.state === 'error') return setError(snap.error || 'Preview failed')
      setPreview(snap.result as DigestRunResult)
    } catch (err) {
      handleApiError(err)
    }
  }

  const sendNow = async () => {
    setError(null)
    setNotice(null)
    setPreview(null)
    try {
      const snap = await job.start(() => api.runDigest())
      if (snap.state === 'error') return setError(snap.error || 'Send failed')
      const r = snap.result as DigestRunResult
      setNotice(
        r.seeding
          ? 'First run complete — baseline seeded. Future digests will list only senders that appear from now on.'
          : r.sent
          ? `Digest sent to ${r.recipient} with ${r.newSenders.length} new sender${r.newSenders.length === 1 ? '' : 's'}.`
          : 'No new marketing senders since the last run — nothing to send.'
      )
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  const running = job.running

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Weekly digest</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Get a weekly email listing new marketing senders that started emailing you, each with an
          unsubscribe link. The digest is sent from your own Gmail to{' '}
          {state?.settings.recipient || accountEmail || 'your account'}.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

        <Alert severity="info" sx={{ mb: 2 }}>
          Scheduled runs require the app to be running and a valid Google sign-in. In Testing-mode
          OAuth, sign-in expires about every 7 days — production verification removes that limit.
        </Alert>

        {!state ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={state.settings.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                />
              }
              label="Enable weekly digest"
            />

            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <TextField
                select
                size="small"
                label="Day"
                value={state.settings.dayOfWeek}
                onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
                sx={{ minWidth: 140 }}
                disabled={!state.settings.enabled}
              >
                {DAYS.map((d, i) => (
                  <MenuItem key={i} value={i}>{d}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Hour"
                value={state.settings.hour}
                onChange={(e) => patch({ hour: Number(e.target.value) })}
                sx={{ minWidth: 110 }}
                disabled={!state.settings.enabled}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}:00</MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              size="small"
              label="Recipient (blank = your account)"
              placeholder={accountEmail}
              value={state.settings.recipient}
              onChange={(e) => patch({ recipient: e.target.value })}
              fullWidth
              sx={{ mt: 2 }}
            />

            <Box sx={{ mt: 1.5 }}>
              <Button variant="contained" size="small" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Button variant="outlined" size="small" onClick={runPreview} disabled={running}>
                {running ? 'Working…' : 'Preview'}
              </Button>
              <Button variant="outlined" size="small" onClick={sendNow} disabled={running}>
                Send now
              </Button>
              {running && <CircularProgress size={18} />}
            </Stack>

            {preview && (
              <Alert severity={preview.seeding ? 'info' : 'success'} sx={{ mt: 2 }}>
                {preview.seeding
                  ? `First run will seed a baseline from ${preview.totalScanned.toLocaleString()} scanned messages. No email is sent on the first run.`
                  : preview.newSenders.length === 0
                  ? 'No new marketing senders since the last run.'
                  : `${preview.newSenders.length} new sender${preview.newSenders.length === 1 ? '' : 's'} would be included:`}
                {!preview.seeding && preview.newSenders.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {preview.newSenders.slice(0, 12).map((s) => (
                      <Chip key={s.email} size="small" label={`${s.name} (${s.messageCount})`} />
                    ))}
                    {preview.newSenders.length > 12 && (
                      <Chip size="small" variant="outlined" label={`+${preview.newSenders.length - 12} more`} />
                    )}
                  </Box>
                )}
              </Alert>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Last run: {fmtDate(state.lastRunAt)} · baseline tracks {state.knownSenderCount.toLocaleString()} senders
              </Typography>
              {state.history.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {state.history.slice(0, 5).map((h, i) => (
                    <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {fmtDate(h.at)} — {h.error ? `error: ${h.error}` : h.sent ? `sent (${h.newSenders} new)` : `${h.newSenders} new, not sent`}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
