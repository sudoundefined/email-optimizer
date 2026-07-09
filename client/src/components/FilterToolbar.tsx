import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import type { Filter } from '../types'

interface Props {
  filters: Filter[]
  activeKey: string | null
  onSelect: (filter: Filter | null) => void
}

export default function FilterToolbar({ filters, activeKey, onSelect }: Props) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2, gap: 0.5 }}>
      {filters.map((f) => (
        <Chip
          key={f.key}
          label={f.label}
          clickable
          variant={activeKey === f.key ? 'filled' : 'outlined'}
          color={activeKey === f.key ? 'primary' : 'default'}
          onClick={() => onSelect(activeKey === f.key ? null : f)}
        />
      ))}
      {activeKey && (
        <Button size="small" variant="text" onClick={() => onSelect(null)}>
          Clear filter
        </Button>
      )}
    </Stack>
  )
}
