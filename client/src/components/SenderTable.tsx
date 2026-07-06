import type { Sender, Suggestion, UnsubMethod } from '../types'

const METHOD_BADGES: Record<UnsubMethod, { label: string; className: string; title: string }> = {
  oneclick: { label: 'One-click', className: 'badge badge-green', title: 'Supports RFC 8058 one-click unsubscribe' },
  mailto: { label: 'Email', className: 'badge badge-blue', title: 'Unsubscribes via an automated email' },
  link: { label: 'Link', className: 'badge badge-yellow', title: 'Provides a link you must open manually' },
  none: { label: 'None', className: 'badge badge-gray', title: 'No unsubscribe header found' },
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
    <div className="table-card">
      <table className="sender-table">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all senders"
              />
            </th>
            <th>Sender</th>
            <th className="num">Emails</th>
            <th>Unsubscribe</th>
            <th>Category</th>
            <th>Latest subject</th>
          </tr>
        </thead>
        <tbody>
          {senders.map((s) => {
            const badge = METHOD_BADGES[s.method]
            const suggestion = suggestions.get(s.email)
            return (
              <tr key={s.email} className={selected.has(s.email) ? 'row-selected' : ''}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.has(s.email)}
                    onChange={() => toggle(s.email)}
                    aria-label={`Select ${s.name || s.email}`}
                  />
                </td>
                <td>
                  <div className="sender-name">{s.name || s.email}</div>
                  {s.name && <div className="sender-email">{s.email}</div>}
                </td>
                <td className="num">{s.messageCount.toLocaleString()}</td>
                <td>
                  <span className={badge.className} title={badge.title}>
                    {badge.label}
                  </span>
                </td>
                <td>
                  {suggestion && (
                    <span title={suggestion.reason} className={`category category-${suggestion.confidence}`}>
                      {suggestion.category}
                    </span>
                  )}
                </td>
                <td className="subject">{s.latestSubject}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
