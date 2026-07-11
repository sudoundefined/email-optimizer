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
