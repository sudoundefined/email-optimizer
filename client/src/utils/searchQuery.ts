/**
 * Pure logic for the tag-based multi-filter search (no React).
 * Spec: docs/superpowers/specs/2026-07-11-tag-search-design.md
 */

export type ChipField =
  | 'tag' | 'from' | 'method' | 'subject' // resolvable against the cached scan
  | 'is' | 'older_than' | 'newer_than' | 'larger' // Gmail-only
  | 'text'

export interface Chip {
  field: ChipField
  value: string
  valid: boolean
  error?: string
  note?: string
}

const METHODS = ['oneclick', 'mailto', 'link', 'none'] as const
const FIELD_PREFIXES = ['tag:', 'from:', 'method:', 'subject:', 'is:unread', 'older_than:', 'newer_than:', 'larger:']

export function parseToken(raw: string, categories: string[]): Chip {
  const text = raw.trim()
  const m = text.match(/^([a-z_]+):(.*)$/i)
  if (!m) return { field: 'text', value: text, valid: text.length > 0, ...(text ? {} : { error: 'Empty token' }) }
  const prefix = m[1].toLowerCase()
  const value = m[2].trim()
  switch (prefix) {
    case 'tag': {
      const match = categories.find((c) => c.toLowerCase() === value.toLowerCase())
      if (!match) return { field: 'tag', value, valid: false, error: `Unknown tag "${value}" — pick a category from your scan` }
      return { field: 'tag', value: match, valid: true }
    }
    case 'method': {
      const v = value.toLowerCase()
      if (!(METHODS as readonly string[]).includes(v))
        return { field: 'method', value, valid: false, error: `Method must be one of: ${METHODS.join(', ')}` }
      return { field: 'method', value: v, valid: true }
    }
    case 'from':
    case 'subject':
      if (!value) return { field: prefix, value, valid: false, error: `${prefix}: needs a value` }
      return { field: prefix, value, valid: true }
    case 'is':
      if (value.toLowerCase() !== 'unread')
        return { field: 'is', value, valid: false, error: 'Only is:unread is supported' }
      return { field: 'is', value: 'unread', valid: true }
    case 'older_than':
    case 'newer_than':
      if (!/^\d+[dmy]$/.test(value))
        return { field: prefix, value, valid: false, error: 'Use Nd, Nm or Ny — e.g. older_than:6m' }
      return { field: prefix, value, valid: true }
    case 'larger':
      if (!/^\d+[km]?$/i.test(value))
        return { field: 'larger', value, valid: false, error: 'Use a size like 5M or 500K' }
      return { field: 'larger', value: value.toUpperCase(), valid: true }
    default:
      // Unrecognized prefix is not an error — match the whole token as free text.
      return { field: 'text', value: text, valid: true, note: `Unknown filter "${prefix}:" — matching as plain text` }
  }
}

export function getSuggestions(partial: string, categories: string[]): string[] {
  const p = partial.trim().toLowerCase()
  if (!p) return [...FIELD_PREFIXES]
  if (p.startsWith('tag:')) {
    const v = p.slice(4)
    return categories.filter((c) => c.toLowerCase().startsWith(v)).map((c) => `tag:${c}`)
  }
  if (p.startsWith('method:')) {
    const v = p.slice(7)
    return METHODS.filter((mth) => mth.startsWith(v)).map((mth) => `method:${mth}`)
  }
  return FIELD_PREFIXES.filter((f) => f.startsWith(p) && f !== p)
}
