import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FILTERS, FILTER_DEFS, trashByFilterKey } from './inboxService.js'

describe('inboxService FILTERS allow-list', () => {
  it('every query is scoped away from trash and spam', () => {
    for (const [key, q] of Object.entries(FILTERS)) {
      assert.ok(q.includes('-in:trash'), `${key} must exclude trash`)
      assert.ok(q.includes('-in:spam'), `${key} must exclude spam`)
    }
  })

  it('FILTER_DEFS is the single source: unique keys, complete fields, derives FILTERS', () => {
    const keys = FILTER_DEFS.map((d) => d.key)
    assert.equal(new Set(keys).size, keys.length, 'keys must be unique')
    for (const d of FILTER_DEFS) {
      assert.ok(d.key && d.label && d.query, `${d.key} needs key/label/query`)
      assert.ok(['engagement', 'cleanup', 'category'].includes(d.category), `${d.key} category`)
      assert.equal(FILTERS[d.key], d.query, `FILTERS derived from FILTER_DEFS for ${d.key}`)
    }
    assert.equal(Object.keys(FILTERS).length, FILTER_DEFS.length)
  })

  it('trashByFilterKey rejects an unknown key with status 400', async () => {
    await assert.rejects(
      () => trashByFilterKey('bogus-key'),
      (err) => err.status === 400
    )
  })
})
