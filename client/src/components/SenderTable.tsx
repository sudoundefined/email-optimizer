import { useEffect, useState } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import type { Sender, Suggestion, UnsubMethod } from '../types'

const METHOD_CHIPS: Record<UnsubMethod, { label: string; bg: string; plain?: boolean }> = {
  oneclick: { label: '⚡ One-click', bg: 'var(--color-accent)' },
  mailto:   { label: '✉ Email',     bg: '#007AFF' },
  link:     { label: '🔗 Link',      bg: '#8E8E93' },
  none:     { label: 'None',         bg: '', plain: true },
}

export const CATEGORY_COLORS: Record<string, string> = {
  Promotions:  '#5856D6',
  Newsletters: '#007AFF',
  Social:      '#FF2D55',
  Shopping:    '#FF9500',
  Finance:     '#34C759',
  Travel:      '#00C7BE',
  Other:       '#AEAEB2',
}

function volumeColor(n: number): string {
  return n > 100 ? '#FF3B30' : n > 20 ? '#FF9500' : '#34C759'
}

export default function SenderTable({
  senders, selected, onSelectedChange, suggestions, protectedSet,
}: {
  senders: Sender[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  suggestions: Map<string, Suggestion>
  protectedSet: Set<string>
}) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(100)

  // Reset to the first page whenever the underlying list changes (filter/sort/scan).
  useEffect(() => { setPage(0) }, [senders])

  const paginate = senders.length > rowsPerPage
  const pageCount = Math.max(1, Math.ceil(senders.length / rowsPerPage))
  const safePage = Math.min(page, pageCount - 1) // clamp so a shrunk list never renders an out-of-range page
  const start = safePage * rowsPerPage
  const pageRows = paginate ? senders.slice(start, start + rowsPerPage) : senders

  // Select-all acts on the CURRENT page; the global selection Set accumulates
  // across pages, so the floating tray still reflects everything selected.
  const allSelected = pageRows.length > 0 && pageRows.every((s) => selected.has(s.email))
  const someSelected = pageRows.some((s) => selected.has(s.email))

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected)
      pageRows.forEach((s) => next.delete(s.email))
      onSelectedChange(next)
    } else {
      onSelectedChange(new Set([...selected, ...pageRows.map((s) => s.email)]))
    }
  }

  const toggle = (email: string) => {
    const next = new Set(selected)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    onSelectedChange(next)
  }

  if (senders.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No senders match this filter.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                aria-label="Select all senders on this page"
                sx={{ color: 'var(--color-accent)', '&.Mui-checked': { color: 'var(--color-accent)' } }}
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
          {pageRows.map((s) => {
            const chip = METHOD_CHIPS[s.method]
            const suggestion = suggestions.get(s.email)
            const catColor = suggestion ? (CATEGORY_COLORS[suggestion.category] ?? '#AEAEB2') : undefined
            const isProtected = protectedSet.has(s.email.toLowerCase())
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
                    sx={{ color: 'var(--color-accent)', '&.Mui-checked': { color: 'var(--color-accent)' } }}
                  />
                </TableCell>
                <TableCell sx={{ maxWidth: 240 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {isProtected && (
                      <Tooltip title="Protected — excluded from bulk unsubscribe and trash">
                        <ShieldOutlined sx={{ fontSize: 15, color: '#34C759', flexShrink: 0 }} />
                      </Tooltip>
                    )}
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: '#1C1C1E' }}>
                        {s.name || s.email}
                      </Typography>
                      {s.name && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {s.email}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: volumeColor(s.messageCount) }}>
                    {s.messageCount.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  {!chip.plain ? (
                    <Box
                      sx={{
                        display: 'inline-flex', alignItems: 'center',
                        px: 1, py: 0.25, borderRadius: '6px',
                        background: chip.bg, fontSize: '0.7rem', fontWeight: 700,
                        color: '#fff', whiteSpace: 'nowrap',
                      }}
                    >
                      {chip.label}
                    </Box>
                  ) : (
                    <Chip size="small" label="None" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  )}
                </TableCell>
                <TableCell>
                  {suggestion && (
                    <Box
                      sx={{
                        display: 'inline-flex', alignItems: 'center',
                        px: 1, py: 0.25, borderRadius: '6px',
                        background: catColor ? `${catColor}18` : 'transparent',
                        border: `1px solid ${catColor ?? '#AEAEB2'}30`,
                        fontSize: '0.7rem', fontWeight: 600,
                        color: catColor ?? '#AEAEB2',
                        fontStyle: suggestion.confidence === 'low' ? 'italic' : 'normal',
                        opacity: suggestion.confidence === 'low' ? 0.7 : 1,
                      }}
                      title={suggestion.reason}
                    >
                      {suggestion.category}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {s.latestSubject}
                  </Typography>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
      {paginate && (
        <TablePagination
          component="div"
          count={senders.length}
          page={safePage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
          rowsPerPageOptions={[50, 100, 200]}
          labelRowsPerPage="Per page"
          sx={{ borderTop: '1px solid rgba(60, 60, 67, 0.08)', flexShrink: 0 }}
        />
      )}
    </Box>
  )
}
