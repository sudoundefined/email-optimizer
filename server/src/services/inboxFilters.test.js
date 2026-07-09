import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { FILTERS, trashByFilterKey } from './inboxService.js'

describe('inboxService FILTERS allow-list', () => {
  it('every query is scoped away from trash and spam', () => {
    for (const [key, q] of Object.entries(FILTERS)) {
      assert.ok(q.includes('-in:trash'), `${key} must exclude trash`)
      assert.ok(q.includes('-in:spam'), `${key} must exclude spam`)
    }
  })

  it('server FILTERS keys match the client FilterToolbar keys (drift guard)', () => {
    const toolbar = fs.readFileSync(
      path.join(import.meta.dirname, '..', '..', '..', 'client', 'src', 'components', 'FilterToolbar.tsx'),
      'utf8'
    )
    const clientKeys = [...toolbar.matchAll(/key:\s*'([a-z-]+)'/g)].map((m) => m[1]).sort()
    const serverKeys = Object.keys(FILTERS).sort()
    assert.deepEqual(serverKeys, clientKeys)
  })

  it('trashByFilterKey rejects an unknown key with status 400', async () => {
    await assert.rejects(
      () => trashByFilterKey('bogus-key'),
      (err) => err.status === 400
    )
  })
})
