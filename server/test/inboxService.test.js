import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GROUPS, getGroup } from '../src/services/inboxService.js'

test('GROUPS: keys are unique and kebab-case', () => {
  const keys = GROUPS.map((g) => g.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const key of keys) assert.match(key, /^[a-z0-9-]+$/)
})

test('GROUPS: label groups carry a labelId, query groups a q', () => {
  for (const g of GROUPS) {
    if (g.kind === 'label') {
      assert.ok(g.labelId, `${g.key} missing labelId`)
      assert.equal(g.q, undefined)
    } else {
      assert.equal(g.kind, 'query')
      assert.ok(g.q, `${g.key} missing q`)
    }
  }
})

test('GROUPS: query groups exclude trash and spam', () => {
  for (const g of GROUPS.filter((g) => g.kind === 'query')) {
    assert.ok(g.q.includes('-in:trash'), `${g.key} must exclude trash`)
    assert.ok(g.q.includes('-in:spam'), `${g.key} must exclude spam`)
  }
})

test('GROUPS: includes the core Gmail categories the UI promises', () => {
  const keys = new Set(GROUPS.map((g) => g.key))
  for (const required of ['important', 'marketing', 'social', 'updates', 'primary']) {
    assert.ok(keys.has(required), `missing group ${required}`)
  }
})

test('getGroup: resolves known keys, null for unknown', () => {
  assert.equal(getGroup('important')?.labelId, 'IMPORTANT')
  assert.equal(getGroup('nope'), null)
})
