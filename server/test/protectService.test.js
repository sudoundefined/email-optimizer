import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setDbForTesting, resetDbForTesting } from '../src/db/db.js'
import {
  PROTECTED_DOMAINS,
  matchesDomainHeuristic,
  matchesSubjectHeuristic,
  autoProtectFromScan,
  listProtected,
  protectSenders,
  unprotectSenders,
  isProtected,
} from '../src/services/protectService.js'

const TEST_USER = 'test-protect-user'

describe('protectService', () => {
  let protectedSet = new Set()

  beforeEach(() => {
    protectedSet.clear()

    const mockSql = async (strings, ...values) => {
      const queryStr = strings.join('?')
      if (queryStr.includes('SELECT 1 FROM protected_senders')) {
        // query is WHERE user_id = ? AND email = ? (or legacy WHERE email = ?)
        const email = queryStr.includes('user_id') ? values[1] : values[0]
        return protectedSet.has(String(email).toLowerCase()) ? [{ '?column?': 1 }] : []
      }
      if (queryStr.includes('FROM protected_senders') && queryStr.includes('SELECT')) {
        return [...protectedSet].map(email => ({
          id: `id_${email}`,
          user_id: TEST_USER,
          email,
          domain: email.split('@')[1] || '',
          source: 'manual',
          added_at: '2026-07-13T12:00:00Z'
        }))
      }
      if (queryStr.includes('INSERT INTO protected_senders')) {
        // VALUES (user_id, email, domain, source)
        const email = queryStr.includes('user_id') ? values[1] : values[0]
        protectedSet.add(String(email).toLowerCase())
        return []
      }
      if (queryStr.includes('DELETE FROM protected_senders')) {
        // WHERE user_id = ? AND email = ANY(?)
        const emailsArg = queryStr.includes('user_id') ? values[1] : values[0]
        const emails = Array.isArray(emailsArg) ? emailsArg : [emailsArg]
        for (const e of emails) {
          protectedSet.delete(String(e).toLowerCase())
        }
        return []
      }
      return []
    }
    setDbForTesting(mockSql)
  })

  afterEach(() => {
    resetDbForTesting()
  })

  it('PROTECTED_DOMAINS includes known banks and government', () => {
    assert.ok(PROTECTED_DOMAINS.some(d => d.includes('chase')))
    assert.ok(PROTECTED_DOMAINS.some(d => d.includes('irs.gov')))
  })

  it('matchesDomainHeuristic: exact and subdomain match', () => {
    assert.ok(matchesDomainHeuristic('chase.com'))
    assert.ok(matchesDomainHeuristic('alerts.chase.com'))
    assert.ok(!matchesDomainHeuristic('randomshop.com'))
  })

  it('matchesSubjectHeuristic: detects keywords', () => {
    assert.ok(matchesSubjectHeuristic(['Your January statement is ready']))
    assert.ok(matchesSubjectHeuristic(['Invoice #12345']))
    assert.ok(!matchesSubjectHeuristic(['Check out our sale!']))
  })

  it('autoProtectFromScan: flags domain + subject matches', () => {
    const senders = new Map([
      ['statements@chase.com', { email: 'statements@chase.com', name: 'Chase', domain: 'chase.com', subjects: ['Your statement is ready'] }],
      ['news@randomshop.com', { email: 'news@randomshop.com', name: 'Shop', domain: 'randomshop.com', subjects: ['Big sale!'] }],
      ['billing@example.com', { email: 'billing@example.com', name: 'Example', domain: 'example.com', subjects: ['Your invoice for March'] }],
    ])
    const result = autoProtectFromScan(senders)
    const emails = result.map(r => r.email)
    assert.ok(emails.includes('statements@chase.com'), 'should flag chase (domain)')
    assert.ok(emails.includes('billing@example.com'), 'should flag example (subject keyword)')
    assert.ok(!emails.includes('news@randomshop.com'), 'should not flag random shop')
  })

  it('protectSenders + listProtected + isProtected round-trip', async () => {
    await protectSenders(TEST_USER, ['a@test.com', 'b@test.com'])
    const list = await listProtected(TEST_USER)
    assert.equal(list.length, 2)
    assert.ok(await isProtected(TEST_USER, 'a@test.com'))
    assert.ok(!(await isProtected(TEST_USER, 'c@test.com')))
  })

  it('unprotectSenders removes entries', async () => {
    await protectSenders(TEST_USER, ['x@test.com', 'y@test.com'])
    await unprotectSenders(TEST_USER, ['x@test.com'])
    assert.ok(!(await isProtected(TEST_USER, 'x@test.com')))
    assert.ok(await isProtected(TEST_USER, 'y@test.com'))
  })

  it('isProtected is case-insensitive', async () => {
    await protectSenders(TEST_USER, ['Case@Test.COM'])
    assert.ok(await isProtected(TEST_USER, 'case@test.com'))
  })
})
