/**
 * Pure logic for the tag-based multi-filter search (no React).
 * Spec: docs/superpowers/specs/2026-07-11-tag-search-design.md
 */

import type { Sender, Suggestion } from '../types'

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
const GMAIL_ONLY: ReadonlySet<ChipField> = new Set(['is', 'older_than', 'newer_than', 'larger'])

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

function includesCI(haystack: string | undefined | null, needle: string): boolean {
  return (haystack || '').toLowerCase().includes(needle.toLowerCase())
}

function groupChips(chips: Chip[]): Map<ChipField, Chip[]> {
  const groups = new Map<ChipField, Chip[]>()
  for (const c of chips) {
    if (!c.valid) continue
    const list = groups.get(c.field) ?? []
    list.push(c)
    groups.set(c.field, list)
  }
  return groups
}

/** OR within a field, AND across fields; free-text chips AND together. */
export function filterSenders(
  senders: Sender[],
  suggestionMap: Map<string, Suggestion>,
  chips: Chip[]
): Sender[] {
  const groups = groupChips(chips)
  if (groups.size === 0) return senders
  return senders.filter((s) => {
    for (const [field, group] of groups) {
      let match: boolean
      switch (field) {
        case 'tag': {
          const cat = suggestionMap.get(s.email)?.category
          match = group.some((c) => c.value === cat)
          break
        }
        case 'from':
          match = group.some((c) => includesCI(s.email, c.value) || includesCI(s.name, c.value) || includesCI(s.domain, c.value))
          break
        case 'method':
          match = group.some((c) => s.method === c.value)
          break
        case 'subject':
          match = group.some((c) => includesCI(s.latestSubject, c.value))
          break
        case 'text':
          match = group.every((c) => includesCI(s.name, c.value) || includesCI(s.email, c.value) || includesCI(s.latestSubject, c.value))
          break
        default:
          match = true // Gmail-only fields are not resolvable against the cache
      }
      if (!match) return false
    }
    return true
  })
}

/** App categories that map 1:1 onto Gmail's native category: operator. */
const GMAIL_NATIVE_TAGS: Record<string, string> = {
  promotions: 'promotions',
  social: 'social',
}

export function needsGmail(chips: Chip[]): boolean {
  return chips.some((c) => c.valid && GMAIL_ONLY.has(c.field))
}

/** Strip Gmail grouping/quoting metacharacters, then quote if spaced (or always, when forced). */
function quoteValue(value: string, forceQuote = false): string {
  const v = value.replace(/["(){}]/g, '')
  return forceQuote || /\s/.test(v) ? `"${v}"` : v
}

export function compileGmailQuery(chips: Chip[], labelPrefix: string): string {
  const groups = groupChips(chips)
  const parts: string[] = []
  for (const [field, group] of groups) {
    if (field === 'method') continue // cache-only concept, inexpressible in a Gmail query
    const terms = group.map((c) => {
      switch (field) {
        case 'tag': {
          const native = GMAIL_NATIVE_TAGS[c.value.toLowerCase()]
          return native ? `category:${native}` : `label:${quoteValue(labelPrefix + c.value)}`
        }
        case 'from': return `from:${quoteValue(c.value)}`
        case 'subject': return `subject:${quoteValue(c.value)}`
        case 'is': return 'is:unread'
        case 'older_than': return `older_than:${c.value}`
        case 'newer_than': return `newer_than:${c.value}`
        case 'larger': return `larger:${c.value}`
        default: return quoteValue(c.value, true) // free text: always quoted so it can't act as a live operator
      }
    })
    if (field === 'text' || terms.length === 1) parts.push(...terms) // text ANDs; singletons need no group
    else parts.push(`(${terms.join(' OR ')})`)
  }
  return parts.join(' ')
}
