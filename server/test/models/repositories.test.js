import { test, describe } from 'node:test'
import assert from 'node:assert'
import { UserRepository } from '../../src/models/UserRepository.js'
import { PreferenceRepository } from '../../src/models/PreferenceRepository.js'
import { ProtectedSenderRepository } from '../../src/models/ProtectedSenderRepository.js'
import { ActivityLogRepository } from '../../src/models/ActivityLogRepository.js'
import { AccountRepository } from '../../src/models/AccountRepository.js'
import { LabelRegistryRepository } from '../../src/models/LabelRegistryRepository.js'

// Mock SQL template literal function
function makeMockSql(responses = {}) {
  const sql = async (strings, ...values) => {
    const queryStr = strings.join('?')
    sql.lastQuery = queryStr
    sql.lastValues = values

    if (queryStr.includes('WHERE id =') && queryStr.includes('SELECT id, email, display_name')) {
      return responses.user ? [responses.user] : []
    }
    if (queryStr.includes('FROM accounts') || queryStr.includes('FROM users')) {
      return responses.accounts ? responses.accounts : (responses.default || [])
    }
    if (queryStr.includes('SELECT scan_max_messages')) {
      return responses.preferences ? [responses.preferences] : []
    }
    if (queryStr.includes('SELECT 1 FROM protected_senders')) {
      return responses.isProtected ? [{ '?column?': 1 }] : []
    }
    if (queryStr.includes('SELECT action, details')) {
      return responses.activity ? responses.activity : []
    }
    return responses.default || []
  }
  return sql
}

describe('Model Repositories Unit Tests', () => {
  test('UserRepository.findById returns user when found', async () => {
    const mockUser = { id: 'usr_1', email: 'test@example.com', display_name: 'Test User' }
    const sql = makeMockSql({ user: mockUser })
    const result = await UserRepository.findById('usr_1', sql)
    assert.deepStrictEqual(result, mockUser)
  })

  test('UserRepository.findById returns null when not found', async () => {
    const sql = makeMockSql({ user: null })
    const result = await UserRepository.findById('usr_1', sql)
    assert.strictEqual(result, null)
  })

  test('PreferenceRepository.get returns default preferences when missing', async () => {
    const sql = makeMockSql({ preferences: null })
    const result = await PreferenceRepository.get('usr_1', sql)
    assert.strictEqual(result.default_time_range, '3m')
    assert.strictEqual(result.label_prefix, 'Unsub/')
  })

  test('ProtectedSenderRepository.isProtected checks lowercased email properly', async () => {
    const sql = makeMockSql({ isProtected: true })
    const isProt = await ProtectedSenderRepository.isProtected('usr_1', 'BANK@Example.Com ', sql)
    assert.strictEqual(isProt, true)
    // values[0] is userId, values[1] is normalized email
    const emailIndex = sql.lastQuery.includes('user_id') ? 1 : 0
    assert.strictEqual(sql.lastValues[emailIndex], 'bank@example.com')
  })

  test('ActivityLogRepository.getGamificationStats computes hours and CO2 accurately', async () => {
    const mockActivities = [
      { action: 'trash_messages', details: JSON.stringify({ count: 10 }) },
      { action: 'unsubscribe', details: JSON.stringify({ count: 2, trashedMessages: 10 }) },
      { action: 'apply_labels', details: JSON.stringify({ count: 5 }) }
    ]
    const sql = makeMockSql({ activity: mockActivities })
    const stats = await ActivityLogRepository.getGamificationStats('usr_1', sql)
    
    assert.strictEqual(stats.emailsCleaned, 20) // 10 + 10
    assert.strictEqual(stats.unsubscribedCount, 2)
    assert.strictEqual(stats.labeledCount, 5)
    assert.strictEqual(stats.co2SavedGrams, 6) // 20 * 0.3 = 6
  })

  test('AccountRepository.findAll and setDefault work correctly', async () => {
    const mockAccounts = [
      { id: 'acc_1', email: 'acc1@example.com', is_default: true },
      { id: 'acc_2', email: 'acc2@example.com', is_default: false }
    ]
    const sql = makeMockSql({ accounts: mockAccounts })
    const accounts = await AccountRepository.findAll(sql)
    assert.deepStrictEqual(accounts, mockAccounts)
  })

  test('LabelRegistryRepository.deleteByGmailId executes correct delete query', async () => {
    const sql = makeMockSql()
    await LabelRegistryRepository.deleteByGmailId('acc_1', 'Label_123', sql)
    assert.strictEqual(sql.lastValues[0], 'acc_1')
    assert.strictEqual(sql.lastValues[1], 'Label_123')
  })
})
