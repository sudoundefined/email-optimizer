import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import { CheckCircle, Warning, Cancel } from '@mui/icons-material'
import type { UnsubResult, UnsubSummary } from '../types'

const STATUS_ICONS = {
  success: <CheckCircle fontSize="small" color="success" />,
  manual: <Warning fontSize="small" color="warning" />,
  failed: <Cancel fontSize="small" color="error" />,
} as const

function ResultRow({ r }: { r: UnsubResult }) {
  return (
    <ListItem
      dense
      secondaryAction={
        r.manualUrl ? (
          <Button size="small" href={r.manualUrl} target="_blank" rel="noopener noreferrer">
            Open
          </Button>
        ) : undefined
      }
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        {STATUS_ICONS[r.status]}
      </ListItemIcon>
      <ListItemText
        primary={r.sender}
        secondary={r.detail}
        slotProps={{
          primary: { variant: 'body2' as const, sx: { fontWeight: 600 } },
          secondary: { variant: 'caption' as const },
        }}
      />
    </ListItem>
  )
}

export default function UnsubscribePanel({
  summary,
  progress,
  running,
}: {
  summary?: UnsubSummary
  progress?: { done: number; total: number; results: UnsubResult[] }
  running?: boolean
}) {
  const results = summary?.results ?? progress?.results ?? []
  return (
    <Paper variant="outlined" sx={{ p: 2, my: 2 }}>
      {running && progress && (
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Unsubscribing… {progress.done} / {progress.total}
        </Typography>
      )}
      {summary && (
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Done: {summary.success} unsubscribed, {summary.manual} need a manual click,{' '}
          {summary.failed} failed
        </Typography>
      )}
      <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {results.map((r) => (
          <ResultRow key={r.sender} r={r} />
        ))}
      </List>
    </Paper>
  )
}
