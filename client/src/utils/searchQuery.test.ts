import { describe, it, expect } from 'vitest'
import { parseToken, getSuggestions } from './searchQuery'

const CATEGORIES = ['Promotions', 'Newsletters', 'Social', 'Food & Dining']

describe('parseToken', () => {
  it('parses a valid tag chip and canonicalizes casing', () => {
    expect(parseToken('tag:promotions', CATEGORIES)).toEqual({ field: 'tag', value: 'Promotions', valid: true })
  })

  it('rejects an unknown tag value', () => {
    const chip = parseToken('tag:banana', CATEGORIES)
    expect(chip.field).toBe('tag')
    expect(chip.valid).toBe(false)
    expect(chip.error).toContain('banana')
  })

  it('parses from and subject chips', () => {
    expect(parseToken('from:amazon', CATEGORIES)).toEqual({ field: 'from', value: 'amazon', valid: true })
    expect(parseToken('subject:invoice due', CATEGORIES)).toEqual({ field: 'subject', value: 'invoice due', valid: true })
  })

  it('rejects an empty from value', () => {
    expect(parseToken('from:', CATEGORIES).valid).toBe(false)
  })

  it('parses and lowercases a valid method chip; rejects unknown methods', () => {
    expect(parseToken('method:OneClick', CATEGORIES)).toEqual({ field: 'method', value: 'oneclick', valid: true })
    expect(parseToken('method:carrier-pigeon', CATEGORIES).valid).toBe(false)
  })

  it('accepts only is:unread', () => {
    expect(parseToken('is:unread', CATEGORIES)).toEqual({ field: 'is', value: 'unread', valid: true })
    expect(parseToken('is:starred', CATEGORIES).valid).toBe(false)
  })

  it('validates older_than / newer_than durations', () => {
    expect(parseToken('older_than:6m', CATEGORIES)).toEqual({ field: 'older_than', value: '6m', valid: true })
    expect(parseToken('newer_than:14d', CATEGORIES)).toEqual({ field: 'newer_than', value: '14d', valid: true })
    expect(parseToken('older_than:soon', CATEGORIES).valid).toBe(false)
  })

  it('validates larger sizes and uppercases the unit', () => {
    expect(parseToken('larger:5m', CATEGORIES)).toEqual({ field: 'larger', value: '5M', valid: true })
    expect(parseToken('larger:500K', CATEGORIES)).toEqual({ field: 'larger', value: '500K', valid: true })
    expect(parseToken('larger:big', CATEGORIES).valid).toBe(false)
  })

  it('treats bare text as a valid free-text chip', () => {
    expect(parseToken('  amazon deals ', CATEGORIES)).toEqual({ field: 'text', value: 'amazon deals', valid: true })
  })

  it('treats an unknown prefix as free text with a note, not an error', () => {
    const chip = parseToken('foo:bar', CATEGORIES)
    expect(chip.field).toBe('text')
    expect(chip.value).toBe('foo:bar')
    expect(chip.valid).toBe(true)
    expect(chip.note).toContain('foo')
  })
})

describe('getSuggestions', () => {
  it('offers all field prefixes for empty input', () => {
    expect(getSuggestions('', CATEGORIES)).toEqual([
      'tag:', 'from:', 'method:', 'subject:', 'is:unread', 'older_than:', 'newer_than:', 'larger:',
    ])
  })

  it('completes field prefixes from a partial word', () => {
    expect(getSuggestions('meth', CATEGORIES)).toEqual(['method:'])
    expect(getSuggestions('is', CATEGORIES)).toEqual(['is:unread'])
  })

  it('suggests category values after tag:', () => {
    expect(getSuggestions('tag:', CATEGORIES)).toEqual([
      'tag:Promotions', 'tag:Newsletters', 'tag:Social', 'tag:Food & Dining',
    ])
    expect(getSuggestions('tag:pro', CATEGORIES)).toEqual(['tag:Promotions'])
  })

  it('suggests method values after method:', () => {
    expect(getSuggestions('method:m', CATEGORIES)).toEqual(['method:mailto'])
  })

  it('returns nothing for text that matches no prefix', () => {
    expect(getSuggestions('zzz', CATEGORIES)).toEqual([])
  })
})

import { filterSenders } from './searchQuery'
import type { Sender, Suggestion } from '../types'

const SENDERS: Sender[] = [
  { email: 'deals@amazon.com', name: 'Amazon Deals', domain: 'amazon.com', messageCount: 40, latestSubject: 'Big sale today', latestDate: 1700000000000, method: 'oneclick' },
  { email: 'news@nytimes.com', name: 'NYT Briefing', domain: 'nytimes.com', messageCount: 12, latestSubject: 'Morning briefing', latestDate: 1700000001000, method: 'link' },
  { email: 'noreply@facebook.com', name: 'Facebook', domain: 'facebook.com', messageCount: 7, latestSubject: 'You have notifications', latestDate: 1700000002000, method: 'none' },
]

function sugg(email: string, category: string): [string, Suggestion] {
  return [email, { senderEmail: email, messageCount: 1, category, confidence: 'high', reason: '' }]
}

const SUGGESTION_MAP = new Map<string, Suggestion>([
  sugg('deals@amazon.com', 'Promotions'),
  sugg('news@nytimes.com', 'Newsletters'),
  sugg('noreply@facebook.com', 'Social'),
])

const emails = (list: Sender[]) => list.map((s) => s.email)

describe('filterSenders', () => {
  it('returns all senders for an empty chip list', () => {
    expect(filterSenders(SENDERS, SUGGESTION_MAP, [])).toEqual(SENDERS)
  })

  it('filters by a single tag chip', () => {
    const chips = [parseToken('tag:Promotions', ['Promotions'])]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com'])
  })

  it('ORs multiple chips of the same field', () => {
    const cats = ['Promotions', 'Social']
    const chips = [parseToken('tag:Promotions', cats), parseToken('tag:Social', cats)]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com', 'noreply@facebook.com'])
  })

  it('ANDs chips across different fields', () => {
    const cats = ['Promotions', 'Social']
    const chips = [parseToken('tag:Promotions', cats), parseToken('tag:Social', cats), parseToken('from:amazon', cats)]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com'])
  })

  it('matches from: against email, name, and domain', () => {
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('from:nytimes.com', [])]))).toEqual(['news@nytimes.com'])
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('from:facebook', [])]))).toEqual(['noreply@facebook.com'])
  })

  it('filters by method and subject', () => {
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('method:none', [])]))).toEqual(['noreply@facebook.com'])
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('subject:briefing', [])]))).toEqual(['news@nytimes.com'])
  })

  it('ANDs free-text chips together', () => {
    const chips = [parseToken('amazon', []), parseToken('sale', [])]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com'])
    const noMatch = [parseToken('amazon', []), parseToken('briefing', [])]
    expect(filterSenders(SENDERS, SUGGESTION_MAP, noMatch)).toEqual([])
  })

  it('ignores invalid chips and Gmail-only chips', () => {
    const chips = [parseToken('tag:banana', ['Promotions']), parseToken('is:unread', [])]
    expect(filterSenders(SENDERS, SUGGESTION_MAP, chips)).toEqual(SENDERS)
  })
})

import { needsGmail, compileGmailQuery } from './searchQuery'

const CATS = ['Promotions', 'Social', 'Newsletters', 'Food & Dining']

describe('needsGmail', () => {
  it('is false for cache-answerable chips', () => {
    expect(needsGmail([parseToken('tag:Promotions', CATS), parseToken('from:amazon', CATS)])).toBe(false)
  })
  it('is true when any Gmail-only chip is present', () => {
    expect(needsGmail([parseToken('from:amazon', CATS), parseToken('is:unread', CATS)])).toBe(true)
    expect(needsGmail([parseToken('older_than:6m', CATS)])).toBe(true)
    expect(needsGmail([parseToken('larger:5M', CATS)])).toBe(true)
  })
  it('ignores invalid chips', () => {
    expect(needsGmail([parseToken('is:starred', CATS)])).toBe(false)
  })
})

describe('compileGmailQuery', () => {
  const P = 'Unsub/'

  it('maps Gmail-native tags to category:', () => {
    expect(compileGmailQuery([parseToken('tag:Promotions', CATS)], P)).toBe('category:promotions')
    expect(compileGmailQuery([parseToken('tag:Social', CATS)], P)).toBe('category:social')
  })

  it('maps non-native tags to the prefixed label, quoting spaces', () => {
    expect(compileGmailQuery([parseToken('tag:Newsletters', CATS)], P)).toBe('label:Unsub/Newsletters')
    expect(compileGmailQuery([parseToken('tag:Food & Dining', CATS)], P)).toBe('label:"Unsub/Food & Dining"')
  })

  it('ORs same-field chips and ANDs across fields', () => {
    const chips = [parseToken('tag:Promotions', CATS), parseToken('tag:Social', CATS), parseToken('is:unread', CATS)]
    expect(compileGmailQuery(chips, P)).toBe('(category:promotions OR category:social) is:unread')
  })

  it('passes through from/subject/is/older_than/newer_than/larger', () => {
    const chips = [
      parseToken('from:amazon', CATS),
      parseToken('subject:order shipped', CATS),
      parseToken('older_than:6m', CATS),
      parseToken('larger:5M', CATS),
    ]
    expect(compileGmailQuery(chips, P)).toBe('from:amazon subject:"order shipped" older_than:6m larger:5M')
  })

  it('quotes free text with spaces and ANDs multiple text chips', () => {
    const chips = [parseToken('big sale', CATS), parseToken('amazon', CATS)]
    expect(compileGmailQuery(chips, P)).toBe('"big sale" amazon')
  })

  it('strips quotes, braces, and parens from values (injection defense)', () => {
    expect(compileGmailQuery([parseToken('from:a"b{c}(d)', CATS)], P)).toBe('from:abcd')
  })

  it('skips invalid chips', () => {
    const chips = [parseToken('tag:banana', CATS), parseToken('from:amazon', CATS)]
    expect(compileGmailQuery(chips, P)).toBe('from:amazon')
  })
})
