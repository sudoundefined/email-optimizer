import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { partitionKeepLatest, isValidSenderEmail } from './retentionService.js'

describe('retentionService partitionKeepLatest', () => {
  const ids = ['n1', 'n2', 'n3', 'n4', 'n5'] // newest-first

  it('keeps the N newest and trashes the rest', () => {
    const r = partitionKeepLatest(ids, 3)
    assert.deepEqual(r.keep, ['n1', 'n2', 'n3'])
    assert.deepEqual(r.toTrash, ['n4', 'n5'])
  })

  it('trashes nothing when keep >= total', () => {
    const r = partitionKeepLatest(ids, 10)
    assert.deepEqual(r.toTrash, [])
    assert.equal(r.keep.length, 5)
  })

  it('keep=0 trashes everything', () => {
    const r = partitionKeepLatest(ids, 0)
    assert.deepEqual(r.toTrash, ids)
    assert.deepEqual(r.keep, [])
  })

  it('handles empty input', () => {
    const r = partitionKeepLatest([], 3)
    assert.deepEqual(r.toTrash, [])
    assert.deepEqual(r.keep, [])
  })

  it('floors and clamps negative keep to 0', () => {
    assert.deepEqual(partitionKeepLatest(ids, -2).toTrash, ids)
    assert.deepEqual(partitionKeepLatest(ids, 2.9).keep, ['n1', 'n2'])
  })
})

describe('retentionService isValidSenderEmail', () => {
  it('accepts plain email addresses', () => {
    assert.ok(isValidSenderEmail('news@example.com'))
    assert.ok(isValidSenderEmail('Foo.Bar+tag@sub.example.co.uk'))
    assert.ok(isValidSenderEmail('  trimmed@example.com  '))
  })

  it('rejects Gmail-operator injection payloads', () => {
    // These would broaden a `from:${email}` query beyond the intended sender.
    assert.ok(!isValidSenderEmail('.com'))
    assert.ok(!isValidSenderEmail('a@b.com OR older_than:1d'))
    assert.ok(!isValidSenderEmail('{x@y.z older_than:1d}'))
    assert.ok(!isValidSenderEmail('x@y.z -in:trash'))
    assert.ok(!isValidSenderEmail('x@y.z"'))
    assert.ok(!isValidSenderEmail('from:evil'))
  })

  it('rejects non-strings and empty', () => {
    assert.ok(!isValidSenderEmail(''))
    assert.ok(!isValidSenderEmail(null))
    assert.ok(!isValidSenderEmail(undefined))
    assert.ok(!isValidSenderEmail(42))
  })
})
