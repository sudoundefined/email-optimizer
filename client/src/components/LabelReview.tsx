import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import { api, ApiError } from '../api'
import type { Sender, Suggestion } from '../types'
import { CATEGORIES } from '../types'
import { useJob } from '../hooks/useJob'

export default function LabelReview({
  senders,
  suggestions,
  onClose,
  onDisconnected,
}: {
  senders: Sender[]
  suggestions: Map<string, Suggestion>
  onClose: () => void
  onDisconnected: () => void
}) {
  const [assignments, setAssignments] = useState<Map<string, string>>(
    () =>
      new Map(senders.map((s) => [s.email, suggestions.get(s.email)?.category || 'Other']))
  )
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [archive, setArchive] = useState(false)
  const applyJob = useJob()

  const byCategory = useMemo(() => {
    const groups = new Map<string, Sender[]>()
    for (const s of senders) {
      const cat = assignments.get(s.email) || 'Other'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(s)
    }
    return groups
  }, [senders, assignments])

  const setCategory = (email: string, category: string) => {
    setAssignments((prev) => new Map(prev).set(email, category))
  }

  const apply = async () => {
    setError(null)
    try {
      const payload = [...assignments].map(([senderEmail, labelName]) => ({ senderEmail, labelName }))
      const snapshot = await applyJob.start(() => api.applyLabels(payload, { topLevel: true, archive }))
      if (snapshot.state === 'error') setError(snapshot.error || 'Applying labels failed')
      else {
        const result = snapshot.result as { applied: { label: string; messages: number }[]; archived?: boolean }
        setDoneMessage(
          `${result.applied.map((a) => `${a.label}: ${a.messages} emails`).join(' · ')}` +
            (result.archived ? ' — moved out of the inbox (recoverable in All Mail).' : ' — tagged in place, still in your inbox.')
        )
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  const progress = applyJob.job?.progress as
    | { labeled?: number; total?: number; currentLabel?: string }
    | null

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review labels</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Each category becomes a Gmail label applied to every scanned email from the sender.
          By default this <strong>tags in place</strong> — nothing leaves your inbox. Review the
          grouping below, then create the labels.
        </Typography>

        {[...byCategory.entries()].map(([category, group]) => (
          <Box key={category} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {category}{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                ({group.length} senders)
              </Typography>
            </Typography>
            {group.map((s) => (
              <Box key={s.email} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {s.name || s.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.messageCount} emails
                </Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={assignments.get(s.email)}
                    onChange={(e) => setCategory(s.email, e.target.value)}
                    disabled={applyJob.running}
                    size="small"
                  >
                    {CATEGORIES.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            ))}
          </Box>
        ))}

        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        {applyJob.running && progress && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Labeling {progress.labeled ?? 0} / {progress.total ?? '?'}
              {progress.currentLabel ? ` (${progress.currentLabel})` : ''}
            </Typography>
            <LinearProgress sx={{ mt: 0.5 }} />
          </Box>
        )}
        {doneMessage && <Alert severity="success" sx={{ mt: 1 }}>Labels applied — {doneMessage}</Alert>}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        {!doneMessage ? (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={archive}
                onChange={(e) => setArchive(e.target.checked)}
                disabled={applyJob.running}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                Also archive tagged emails (move out of inbox)
              </Typography>
            }
          />
        ) : <span />}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={applyJob.running}>
            {doneMessage ? 'Close' : 'Cancel'}
          </Button>
          {!doneMessage && (
            <Button variant="contained" onClick={apply} disabled={applyJob.running}>
              {applyJob.running ? 'Applying…' : archive ? 'Create labels, tag & archive' : 'Create labels & tag'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}
