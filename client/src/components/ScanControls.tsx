import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import type { JobSnapshot, ScanResult } from '../types'

const RANGES = [
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
]

export default function ScanControls({
  onScan,
  job,
  running,
  scan,
}: {
  onScan: (range: string) => void
  job: JobSnapshot | null
  running: boolean
  scan: ScanResult | null
}) {
  const [range, setRange] = useState('6m')
  const progress = job?.progress as { phase?: string; listed?: number; fetched?: number; total?: number } | null

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Range</InputLabel>
            <Select
              value={range}
              label="Range"
              onChange={(e) => setRange(e.target.value)}
              disabled={running}
            >
              {RANGES.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={() => onScan(range)} disabled={running}>
            {running ? 'Scanning…' : 'Scan mailbox'}
          </Button>

          {!running && scan && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, ml: 'auto', flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                <Typography component="span" variant="h6" color="text.primary" sx={{ fontWeight: 600, mr: 0.5 }}>
                  {scan.senders.length.toLocaleString()}
                </Typography>
                senders
              </Typography>
              <Divider orientation="vertical" flexItem />
              <Typography variant="body2" color="text.secondary">
                <Typography component="span" variant="h6" color="text.primary" sx={{ fontWeight: 600, mr: 0.5 }}>
                  {scan.messageCount.toLocaleString()}
                </Typography>
                emails
              </Typography>
              <Typography variant="caption" color="text.secondary">
                scanned {new Date(scan.scannedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>

        {running && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {progress?.phase === 'listing' && `Finding messages… ${progress.listed ?? 0} found`}
              {progress?.phase === 'fetching' &&
                `Reading headers… ${progress.fetched ?? 0} / ${progress.total ?? '?'}`}
              {progress?.phase === 'grouping' && 'Grouping senders…'}
              {!progress?.phase && 'Starting scan…'}
            </Typography>
            <LinearProgress sx={{ mt: 1 }} />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
