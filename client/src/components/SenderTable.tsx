import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import type { Sender, Suggestion, UnsubMethod } from '../types'

const METHOD_CHIPS: Record<UnsubMethod, { label: string; color: 'success' | 'info' | 'warning' | 'default' }> = {
  oneclick: { label: 'One-click', color: 'success' },
  mailto: { label: 'Email', color: 'info' },
  link: { label: 'Link', color: 'warning' },
  none: { label: 'None', color: 'default' },
}

export default function SenderTable({
  senders,
  selected,
  onSelectedChange,
  suggestions,
}: {
  senders: Sender[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  suggestions: Map<string, Suggestion>
}) {
  const allSelected = senders.length > 0 && senders.every((s) => selected.has(s.email))

  const toggleAll = () => {
    onSelectedChange(allSelected ? new Set() : new Set(senders.map((s) => s.email)))
  }

  const toggle = (email: string) => {
    const next = new Set(selected)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    onSelectedChange(next)
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={selected.size > 0 && !allSelected}
                onChange={toggleAll}
                aria-label="Select all senders"
              />
            </TableCell>
            <TableCell>Sender</TableCell>
            <TableCell align="right">Emails</TableCell>
            <TableCell>Unsubscribe</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Latest subject</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {senders.map((s) => {
            const chip = METHOD_CHIPS[s.method]
            const suggestion = suggestions.get(s.email)
            return (
              <TableRow
                key={s.email}
                selected={selected.has(s.email)}
                hover
                onClick={() => toggle(s.email)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selected.has(s.email)}
                    onChange={() => toggle(s.email)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${s.name || s.email}`}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {s.name || s.email}
                  </Typography>
                  {s.name && (
                    <Typography variant="caption" color="text.secondary">
                      {s.email}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{s.messageCount.toLocaleString()}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={chip.label}
                    color={chip.color}
                    variant={chip.color === 'default' ? 'outlined' : 'filled'}
                  />
                </TableCell>
                <TableCell>
                  {suggestion && (
                    <Typography
                      variant="body2"
                      color={suggestion.confidence === 'low' ? 'text.secondary' : 'text.primary'}
                      sx={{ fontStyle: suggestion.confidence === 'low' ? 'italic' : 'normal' }}
                      title={suggestion.reason}
                    >
                      {suggestion.category}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {s.latestSubject}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
