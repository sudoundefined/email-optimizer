import * as XLSX from 'xlsx'
import type { Sender } from '../types'

/**
 * Split a display name into first and last name on the first space.
 * "John Smith"       → { first: "John", last: "Smith" }
 * "John van der Berg"→ { first: "John", last: "van der Berg" }
 * "Jane"             → { first: "Jane", last: "" }
 * ""                 → { first: "", last: "" }
 */
function splitName(name: string): { first: string; last: string } {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return { first: '', last: '' }
  const idx = trimmed.indexOf(' ')
  if (idx === -1) return { first: trimmed, last: '' }
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1).trim() }
}

/**
 * Export an array of Sender objects to an .xlsx file and trigger a browser download.
 * Columns: Email, Name, First Name, Last Name, Domain
 * Filename: Email_export_<unix_timestamp>.xlsx
 */
export function exportToExcel(senders: Sender[]): void {
  const rows = senders.map((s) => {
    const { first, last } = splitName(s.name)
    return {
      Email: s.email,
      Name: s.name,
      'First Name': first,
      'Last Name': last,
      Domain: s.domain,
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Auto-size columns based on header + data widths
  const headers = ['Email', 'Name', 'First Name', 'Last Name', 'Domain']
  worksheet['!cols'] = headers.map((h) => {
    const dataKey = h as keyof (typeof rows)[0]
    const maxDataLen = rows.reduce((max, row) => Math.max(max, (row[dataKey] ?? '').length), 0)
    return { wch: Math.max(h.length, maxDataLen) + 2 }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Senders')

  const timestamp = Math.floor(Date.now() / 1000)
  XLSX.writeFile(workbook, `Email_export_${timestamp}.xlsx`)
}
