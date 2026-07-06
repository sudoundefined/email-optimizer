import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

export default function ConfirmDialog({
  title,
  message,
  danger,
  requireTypedCount,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  danger?: boolean
  requireTypedCount?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const [armed, setArmed] = useState(!danger)

  // short arming delay so a double-click can't confirm a destructive action
  useEffect(() => {
    if (!danger) return
    const t = setTimeout(() => setArmed(true), 1500)
    return () => clearTimeout(t)
  }, [danger])

  const typedOk = requireTypedCount === undefined || typed.trim() === String(requireTypedCount)

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>{message}</Typography>
        {requireTypedCount !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              Type <strong>{requireTypedCount}</strong> to confirm:
            </Typography>
            <TextField
              size="small"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              sx={{ width: 120 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          color={danger ? 'error' : 'primary'}
          disabled={!armed || !typedOk}
          onClick={onConfirm}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
