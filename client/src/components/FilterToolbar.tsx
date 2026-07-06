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
    <div className="filter-toolbar">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`badge ${activeKey === f.key ? 'badge-active' : 'badge-gray'}`}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelect(activeKey === f.key ? null : f)}
        >
          {f.label}
        </button>
      ))}
      {activeKey && (
        <button className="btn btn-small btn-ghost" onClick={() => onSelect(null)}>
          Clear filter
        </button>
      )}
    </div>
  )
}
