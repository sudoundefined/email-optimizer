import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateBySender,
  aggregateByMonth,
  filterLargeAttachments,
  bytesToMB,
} from '../src/services/storageService.js'

describe('storageService aggregation', () => {
  const messages = [
    { id: '1', from: 'alice@example.com', sizeEstimate: 5_000_000, date: new Date('2024-01-15').getTime(), hasAttachment: true, subject: 'Report' },
    { id: '2', from: 'alice@example.com', sizeEstimate: 3_000_000, date: new Date('2024-01-20').getTime(), hasAttachment: false, subject: 'Update' },
    { id: '3', from: 'bob@other.com', sizeEstimate: 10_000_000, date: new Date('2024-03-05').getTime(), hasAttachment: true, subject: 'Big file' },
    { id: '4', from: 'alice@example.com', sizeEstimate: 1_000_000, date: new Date('2024-03-10').getTime(), hasAttachment: false, subject: 'Note' },
  ]

  it('aggregateBySender groups and sums correctly', () => {
    const result = aggregateBySender(messages, 10)
    assert.equal(result.length, 2)
    const alice = result.find(s => s.email === 'alice@example.com')
    assert.ok(alice)
    assert.equal(alice.messageCount, 3)
    assert.ok(Math.abs(alice.totalMB - bytesToMB(9_000_000)) < 0.01)
    // sorted by size desc
    assert.equal(result[0].email, 'bob@other.com')
  })

  it('aggregateByMonth groups and sums correctly', () => {
    const result = aggregateByMonth(messages, 12)
    assert.ok(result.length >= 2)
    const jan = result.find(m => m.month === '2024-01')
    assert.ok(jan)
    assert.equal(jan.messageCount, 2)
    assert.ok(Math.abs(jan.totalMB - bytesToMB(8_000_000)) < 0.01)
  })

  it('filterLargeAttachments returns only messages with attachments above threshold', () => {
    const result = filterLargeAttachments(messages, 4)
    assert.equal(result.length, 2)
    assert.ok(result.every(m => m.sizeMB >= 4))
  })

  it('bytesToMB converts correctly', () => {
    assert.ok(Math.abs(bytesToMB(1_048_576) - 1) < 0.01)
    assert.equal(bytesToMB(0), 0)
  })

  it('aggregateBySender respects limit', () => {
    const result = aggregateBySender(messages, 1)
    assert.equal(result.length, 1)
  })

  it('aggregateByMonth sorts by month desc', () => {
    const result = aggregateByMonth(messages, 12)
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].month >= result[i].month)
    }
  })
})
