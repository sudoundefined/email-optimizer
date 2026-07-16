import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  ScanCacheRepository,
  SenderCacheRepository,
  CleanupHistoryRepository,
  WeeklyDigestRepository,
  SavedViewRepository,
  ScanMetadataRepository
} from '../../src/models/index.js'

/**
 * Mock SQL template tag (`sql` function) supporting nested query fragments and exact query recording.
 */
function makeMockSql(responses = {}) {
  const queries = []
  const sql = function (strings, ...values) {
    let queryStr = ''
    for (let i = 0; i < strings.length; i++) {
      queryStr += strings[i]
      if (i < values.length) {
        const val = values[i]
        if (val && typeof val === 'object' && val._isQuery) {
          queryStr += val.queryStr
        } else {
          queryStr += '?'
        }
      }
    }

    const queryObj = {
      _isQuery: true,
      queryStr,
      values,
      then(resolve, reject) {
        const normalized = queryStr.replace(/\s+/g, ' ').trim()
        queries.push({ text: normalized, values })
        let res = []
        if (normalized.includes('FROM scan_cache WHERE user_id =') || normalized.includes('FROM scan_cache WHERE account_id =')) {
          res = responses.scanCache !== undefined ? (responses.scanCache ? [responses.scanCache] : []) : [{ user_id: 'acc-123', account_id: 'acc-123', total_messages: 500, storage_used_mb: 12.5, health_score: 95 }]
        } else if (normalized.includes('INSERT INTO scan_cache')) {
          res = [{ user_id: values[0], account_id: values[0], total_messages: values[1], health_score: values[6] }]
        } else if ((normalized.includes('FROM sender_cache WHERE user_id =') || normalized.includes('FROM sender_cache WHERE account_id =')) && normalized.includes('AND sender_email =')) {
          res = responses.senderByEmail !== undefined ? (responses.senderByEmail ? [responses.senderByEmail] : []) : [{ id: 1, user_id: 'acc-123', account_id: 'acc-123', sender_email: 'amazon@amazon.com', category: 'Shopping', total_messages: 10 }]
        } else if (normalized.includes('FROM sender_cache WHERE user_id =') || normalized.includes('FROM sender_cache WHERE account_id =')) {
          res = responses.sendersList || [{ id: 1, sender_email: 'amazon@amazon.com' }]
        } else if (normalized.includes('INSERT INTO sender_cache')) {
          res = [{ id: 1, user_id: values[0], account_id: values[0], sender_email: values[1] }]
        } else if (normalized.includes('DELETE FROM sender_cache')) {
          res = []
        } else if (normalized.includes('SELECT COALESCE(SUM(emails_removed)')) {
          res = responses.cleanupStats !== undefined ? [responses.cleanupStats] : [{ total_emails_removed: 150, total_storage_saved_mb: '45.20', total_time_saved_seconds: 600, total_sessions: 3 }]
        } else if (normalized.includes('FROM cleanup_history WHERE user_id =') || normalized.includes('FROM cleanup_history WHERE account_id =')) {
          res = responses.cleanupRecent || [{ id: 1, user_id: values[0], account_id: values[0], emails_removed: 50 }]
        } else if (normalized.includes('INSERT INTO cleanup_history')) {
          res = [{ id: 1, user_id: values[0], account_id: values[0], emails_removed: values[1], storage_saved_mb: values[2] }]
        } else if ((normalized.includes('FROM weekly_digest WHERE user_id =') || normalized.includes('FROM weekly_digest WHERE account_id =')) && normalized.includes('AND week_start =')) {
          res = responses.digestByWeek !== undefined ? (responses.digestByWeek ? [responses.digestByWeek] : []) : [{ id: 10, user_id: values[0], account_id: values[0], week_start: values[1], summary: { health: 90 } }]
        } else if (normalized.includes('FROM weekly_digest WHERE user_id =') || normalized.includes('FROM weekly_digest WHERE account_id =')) {
          res = responses.digestList || [{ id: 10, user_id: values[0], account_id: values[0], week_start: '2026-07-13' }]
        } else if (normalized.includes('INSERT INTO weekly_digest')) {
          res = [{ id: 10, user_id: values[0], account_id: values[0], week_start: values[1] }]
        } else if (normalized.includes('FROM saved_views WHERE user_id =') || normalized.includes('FROM saved_views WHERE account_id =')) {
          res = responses.savedViews || [{ id: 5, user_id: values[0], account_id: values[0], name: 'Newsletters' }]
        } else if (normalized.includes('INSERT INTO saved_views')) {
          res = [{ id: 5, user_id: values[0], account_id: values[0], name: values[1] }]
        } else if ((normalized.includes('FROM scan_metadata WHERE user_id =') || normalized.includes('FROM scan_metadata WHERE account_id =')) && normalized.includes('ORDER BY started_at DESC LIMIT 1')) {
          res = responses.scanMetadataLatest !== undefined ? (responses.scanMetadataLatest ? [responses.scanMetadataLatest] : []) : [{ scan_id: 101, user_id: values[0], account_id: values[0], status: 'success', duration_ms: 1200 }]
        } else if (normalized.includes('FROM scan_metadata WHERE user_id =') || normalized.includes('FROM scan_metadata WHERE account_id =')) {
          res = responses.scanMetadataList || [{ scan_id: 101, user_id: values[0], account_id: values[0], status: 'success' }]
        } else if (normalized.includes('INSERT INTO scan_metadata')) {
          res = [{ scan_id: 101, user_id: values[0], account_id: values[0], status: values[6] }]
        }
        resolve(res)
      }
    }
    return queryObj
  }
  sql.queries = queries
  sql.unsafe = async (text, values) => {
    queries.push({ text, values })
    return []
  }
  return sql
}

describe('Cache & History Repositories Unit Tests (Tables 8-13)', () => {
  test('ScanCacheRepository.getByAccountId returns summary when present', async () => {
    const sql = makeMockSql()
    const summary = await ScanCacheRepository.getByAccountId('acc-123', sql)
    assert.ok(summary)
    assert.equal(summary.account_id, 'acc-123')
    assert.equal(summary.total_messages, 500)
    assert.equal(sql.queries[0].values[0], 'acc-123')
  })

  test('ScanCacheRepository.upsert formats metrics cleanly and executes ON CONFLICT query', async () => {
    const sql = makeMockSql()
    const res = await ScanCacheRepository.upsert('acc-123', {
      totalMessages: 1000,
      totalSenders: 50,
      storageUsedMb: 100.5,
      healthScore: 88,
      mailboxDna: { Newsletters: 40, Shopping: 60 }
    }, sql)
    assert.ok(res)
    const insertQuery = sql.queries.find(q => q.text.includes('INSERT INTO scan_cache'))
    assert.ok(insertQuery)
    assert.equal(insertQuery.values[0], 'acc-123')
    assert.equal(insertQuery.values[1], 1000) // totalMessages
    assert.ok(insertQuery.text.includes('ON CONFLICT (user_id) DO UPDATE SET') || insertQuery.text.includes('ON CONFLICT (account_id) DO UPDATE SET'))
  })

  test('SenderCacheRepository.findByEmail finds exact email match', async () => {
    const sql = makeMockSql()
    const sender = await SenderCacheRepository.findByEmail('acc-123', 'amazon@amazon.com', sql)
    assert.ok(sender)
    assert.equal(sender.category, 'Shopping')
  })

  test('SenderCacheRepository.listByAccountId applies SARGable category and unread filters', async () => {
    const sql = makeMockSql()
    await SenderCacheRepository.listByAccountId('acc-123', { category: 'Shopping', unreadOnly: true, limit: 100 }, sql)
    const query = sql.queries[0].text
    assert.ok(query.includes('WHERE user_id = ?') || query.includes('WHERE account_id = ?'))
    assert.ok(query.includes('AND category = ?'))
    assert.ok(query.includes('AND unread_messages > 0'))
    assert.ok(query.includes('ORDER BY last_received DESC NULLS LAST'))
  })

  test('SenderCacheRepository.upsertBatch processes senders cleanly and chunks arrays', async () => {
    const sql = makeMockSql()
    const senders = [
      { email: 'a@test.com', name: 'A', messageCount: 5, category: 'Newsletters' },
      { email: 'b@test.com', name: 'B', messageCount: 12, category: 'Shopping' }
    ]
    const res = await SenderCacheRepository.upsertBatch('acc-123', senders, new Date('2026-07-14T10:00:00Z'), sql)
    assert.equal(res.length, 2)
    const insertQueries = sql.queries.filter(q => q.text.includes('INSERT INTO sender_cache'))
    assert.equal(insertQueries.length, 2)
    assert.ok(insertQueries[0].text.includes('ON CONFLICT (user_id, sender_email) DO UPDATE SET') || insertQueries[0].text.includes('ON CONFLICT (account_id, sender_email) DO UPDATE SET'))
  })

  test('SenderCacheRepository.pruneStale deletes rows older than scan timestamp', async () => {
    const sql = makeMockSql()
    const scanTime = new Date('2026-07-14T10:00:00Z')
    await SenderCacheRepository.pruneStale('acc-123', scanTime, sql)
    assert.ok(sql.queries[0].text.includes('DELETE FROM sender_cache WHERE user_id = ? AND updated_at < ?') || sql.queries[0].text.includes('DELETE FROM sender_cache WHERE account_id = ? AND updated_at < ?'))
  })

  test('CleanupHistoryRepository.record and getSummaryStats aggregate accurate totals', async () => {
    const sql = makeMockSql()
    await CleanupHistoryRepository.record('acc-123', { emailsRemoved: 50, storageSavedMb: 15.5, timeSavedSeconds: 200, durationSeconds: 5 }, sql)
    assert.ok(sql.queries[0].text.includes('INSERT INTO cleanup_history'))

    const stats = await CleanupHistoryRepository.getSummaryStats('acc-123', sql)
    assert.equal(stats.total_emails_removed, 150)
    assert.equal(stats.total_storage_saved_mb, '45.20')
  })

  test('WeeklyDigestRepository.upsert and getByWeek round-trip JSONB summary', async () => {
    const sql = makeMockSql()
    await WeeklyDigestRepository.upsert('acc-123', '2026-07-13', { health: 90 }, sql)
    assert.ok(sql.queries[0].text.includes('INSERT INTO weekly_digest'))
    assert.ok(sql.queries[0].text.includes('ON CONFLICT (user_id, week_start) DO UPDATE SET') || sql.queries[0].text.includes('ON CONFLICT (account_id, week_start) DO UPDATE SET'))

    const digest = await WeeklyDigestRepository.getByWeek('acc-123', '2026-07-13', sql)
    assert.ok(digest)
    assert.equal(digest.week_start, '2026-07-13')
  })

  test('SavedViewRepository.createOrUpdate stores custom view filters and sorting', async () => {
    const sql = makeMockSql()
    await SavedViewRepository.createOrUpdate('acc-123', 'High Storage Newsletters', { category: 'Newsletters', minStorageMb: 10 }, { last_received: 'DESC' }, sql)
    const query = sql.queries[0].text
    assert.ok(query.includes('INSERT INTO saved_views'))
    assert.ok(query.includes('ON CONFLICT (user_id, name) DO UPDATE SET') || query.includes('ON CONFLICT (account_id, name) DO UPDATE SET'))
  })

  test('ScanMetadataRepository.record inserts entry AND enforces 100-run retention ceiling', async () => {
    const sql = makeMockSql()
    await ScanMetadataRepository.record('acc-123', {
      startedAt: new Date(),
      completedAt: new Date(),
      emailsScanned: 250,
      sendersFound: 45,
      durationMs: 1500,
      status: 'success'
    }, sql)
    assert.equal(sql.queries.length, 2)
    assert.ok(sql.queries[0].text.includes('INSERT INTO scan_metadata'))
    assert.ok(sql.queries[1].text.includes('DELETE FROM scan_metadata WHERE user_id = ? AND scan_id NOT IN') || sql.queries[1].text.includes('DELETE FROM scan_metadata WHERE account_id = ? AND scan_id NOT IN'))
    assert.ok(sql.queries[1].text.includes('LIMIT 100'))
  })

  test('ScanMetadataRepository.getLatest returns most recent run', async () => {
    const sql = makeMockSql()
    const latest = await ScanMetadataRepository.getLatest('acc-123', sql)
    assert.ok(latest)
    assert.equal(latest.status, 'success')
    assert.equal(latest.duration_ms, 1200)
  })
})
