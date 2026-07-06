import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import type { Filter } from '../types'

const FILTERS: Filter[] = [
  { key: 'never-opened', label: 'Never opened', query: 'is:unread older_than:6m -in:trash -in:spam', category: 'engagement' },
  { key: 'low-engagement', label: 'Rarely read', query: 'is:unread older_than:3m -in:trash -in:spam', category: 'engagement' },
  { key: 'unread-marketing', label: 'Unread marketing', query: 'is:unread category:promotions -in:trash -in:spam', category: 'category' },
  { key: 'unread-social', label: 'Unread social', query: 'is:unread category:social -in:trash -in:spam', category: 'category' },
  { key: 'old-newsletters', label: 'Old newsletters', query: 'category:updates older_than:1y -in:trash -in:spam', category: 'category' },
  { key: 'old-attachments', label: 'Old with attachments', query: 'has:attachment older_than:1y -in:trash -in:spam', category: 'cleanup' },
  { key: 'large-emails', label: 'Large (>5 MB)', query: 'larger:5M -in:trash -in:spam', category: 'cleanup' },
  { key: 'stale-unread', label: 'Unread 6 mo+', query: 'is:unread older_than:6m -in:trash -in:spam', category: 'cleanup' },
  { key: 'old-promotions', label: 'Old promotions', query: 'category:promotions older_than:1y -in:trash -in:spam', category: 'cleanup' },
  { key: 'old-forums', label: 'Old forums', query: 'category:forums older_than:1y -in:trash -in:spam', category: 'category' },
]

export { FILTERS }

interface Props {
  activeKey: string | null
  onSelect: (filter: Filter | null) => void
}

export default function FilterToolbar({ activeKey, onSelect }: Props) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2, gap: 0.5 }}>
      {FILTERS.map((f) => (
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
