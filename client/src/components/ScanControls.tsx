import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import { SearchOutlined as ScanIcon, PeopleOutlined as PeopleIcon, MailOutlined as MailIcon } from '@mui/icons-material'
import type { JobSnapshot, ScanResult } from '../types'

const RANGES = [
  { value: '1m',  label: 'Last month' },
  { value: '3m',  label: 'Last 3 months' },
  { value: '6m',  label: 'Last 6 months' },
  { value: '1y',  label: 'Last year' },
  { value: 'all', label: 'All time' },
]

const STAT_CARDS = [
  {
    key: 'senders',
    icon: <PeopleIcon sx={{ fontSize: 18 }} />,
    label: 'senders',
    color: 'var(--color-accent)',
    bg: 'var(--color-accent)',
    getValue: (s: ScanResult) => s.senders.length,
  },
  {
    key: 'emails',
    icon: <MailIcon sx={{ fontSize: 18 }} />,
    label: 'emails scanned',
    color: 'var(--color-accent)',
    bg: 'var(--color-accent)',
    getValue: (s: ScanResult) => s.messageCount,
  },
]

export default function ScanControls({
  onScan, onCancel, job, running, scan,
}: {
  onScan: (range: string) => void
  onCancel?: () => void
  job: JobSnapshot | null
  running: boolean
  scan: ScanResult | null
}) {
  const [range, setRange] = useState('6m')
  const progress = job?.progress as { phase?: string; listed?: number; fetched?: number; total?: number } | null

  return (
    <Card
      sx={{
        mb: 3,
        background: 'var(--color-dominant-light)',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
          {/* Range picker */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Scan range</InputLabel>
            <Select
              value={range}
              label="Scan range"
              onChange={(e) => setRange(e.target.value)}
              disabled={running}
            >
              {RANGES.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Scan button */}
          <Button
            variant="contained"
            startIcon={<ScanIcon />}
            onClick={() => onScan(range)}
            disabled={running}
            sx={{
              background: running
                ? undefined
                : 'var(--color-accent)',
              px: 2.5,
            }}
          >
            {running ? 'Scanning…' : 'Scan mailbox'}
          </Button>

          {/* Cancel button — only while a scan is running */}
          {running && onCancel && (
            <Button
              variant="outlined"
              color="error"
              onClick={onCancel}
              sx={{ px: 2 }}
            >
              Cancel
            </Button>
          )}

          {/* Stat pills — only when scan loaded and not running */}
          {!running && scan && (
            <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              {STAT_CARDS.map((s) => (
                <Box
                  key={s.key}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    background: s.bg,
                    borderRadius: '10px',
                    px: 1.75, py: 0.875,
                  }}
                >
                  <Box sx={{ color: 'rgba(255,255,255,0.85)', display: 'flex' }}>{s.icon}</Box>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem', lineHeight: 1 }}>
                      {s.getValue(scan).toLocaleString()}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.67rem', fontWeight: 600, lineHeight: 1 }}>
                      {s.label}
                    </Typography>
                  </Box>
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                scanned {new Date(scan.scannedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Progress */}
        {running && (
          <Box sx={{ mt: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {progress?.phase === 'listing'  && `🔍 Finding messages… ${progress.listed ?? 0} found`}
              {progress?.phase === 'fetching' && `📬 Reading headers… ${progress.fetched ?? 0} / ${progress.total ?? '?'}`}
              {progress?.phase === 'grouping' && '📊 Grouping senders…'}
              {!progress?.phase              && '⏳ Starting scan…'}
            </Typography>
            <LinearProgress sx={{ mt: 1 }} />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
