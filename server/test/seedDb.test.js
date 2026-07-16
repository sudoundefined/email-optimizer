import { test } from 'node:test'
import assert from 'node:assert'
import { seedDemoAccount } from '../scripts/seedDb.js'

test('seedDemoAccount executes SQL queries against all 13 tables in 1:1 user model', async () => {
  const queries = []
  const mockSql = async (strings, ...values) => {
    const text = strings.join('?')
    queries.push({ text, values })
    return []
  }
  mockSql.unsafe = async (raw) => {
    queries.push({ text: raw, values: [] })
    return []
  }

  await seedDemoAccount(mockSql)

  assert.ok(queries.length > 0, 'Should execute SQL queries')
  const allSqlText = queries.map(q => q.text).join(' ')
  assert.ok(allSqlText.includes('INSERT INTO users'), 'Should seed users')
  assert.ok(allSqlText.includes('INSERT INTO tokens'), 'Should seed tokens')
  assert.ok(allSqlText.includes('INSERT INTO preferences'), 'Should seed preferences')
  assert.ok(allSqlText.includes('INSERT INTO protected_senders'), 'Should seed protected_senders')
  assert.ok(allSqlText.includes('INSERT INTO label_registry'), 'Should seed label_registry')
  assert.ok(allSqlText.includes('INSERT INTO saved_views'), 'Should seed saved_views')
  assert.ok(allSqlText.includes('INSERT INTO activity_log'), 'Should seed activity_log')
  assert.ok(allSqlText.includes('INSERT INTO digest_baseline'), 'Should seed digest_baseline')
  assert.ok(allSqlText.includes('INSERT INTO scan_cache'), 'Should seed scan_cache')
  assert.ok(allSqlText.includes('INSERT INTO sender_cache'), 'Should seed sender_cache')
  assert.ok(allSqlText.includes('INSERT INTO cleanup_history'), 'Should seed cleanup_history')
  assert.ok(allSqlText.includes('INSERT INTO weekly_digest'), 'Should seed weekly_digest')
  assert.ok(allSqlText.includes('INSERT INTO scan_metadata'), 'Should seed scan_metadata')
})
