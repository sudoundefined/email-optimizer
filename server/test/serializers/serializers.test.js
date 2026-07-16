import { test, describe } from 'node:test'
import assert from 'node:assert'
import { serializeUser } from '../../src/serializers/userSerializer.js'
import { serializeScanResult } from '../../src/serializers/scanSerializer.js'

describe('Serializers Unit Tests', () => {
  test('serializeUser strips internal DB fields and formats preferences cleanly', () => {
    const rawUser = {
      id: 'sub_123',
      email: 'user@example.com',
      display_name: 'Test User',
      avatar_url: 'https://example.com/pic.png',
      internal_db_key: 'secret'
    }
    const rawPrefs = {
      scan_max_messages: 500,
      default_time_range: '6m',
      digest_enabled: 1
    }

    const res = serializeUser(rawUser, rawPrefs)
    assert.strictEqual(res.id, 'sub_123')
    assert.strictEqual(res.displayName, 'Test User')
    assert.strictEqual(res.internal_db_key, undefined)
    assert.strictEqual(res.preferences.digestEnabled, true)
  })

  test('serializeScanResult maps sender list accurately', () => {
    const rawScan = {
      summary: { totalMessagesScanned: 100 },
      senders: [
        { email: 'newsletter@store.com', count: 10, hasUnsubscribe: true, isProtected: false }
      ]
    }
    const res = serializeScanResult(rawScan)
    assert.strictEqual(res.summary.totalMessagesScanned, 100)
    assert.strictEqual(res.summary.unsubscribableSendersCount, 1)
    assert.strictEqual(res.senders[0].messageCount, 10)
  })
})
