import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getDb } from '../src/db/db.js'
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
  before(() => {
    const db = getDb()
    db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').run(TEST_USER, 'testprotect@x.com')
  })

  beforeEach(() => {
    const db = getDb()
    db.prepare('DELETE FROM protected_senders WHERE user_id = ?').run(TEST_USER)
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

  it('protectSenders + listProtected + isProtected round-trip', () => {
    protectSenders(TEST_USER, ['a@test.com', 'b@test.com'])
    const list = listProtected(TEST_USER)
    assert.equal(list.length, 2)
    assert.ok(isProtected(TEST_USER, 'a@test.com'))
    assert.ok(!isProtected(TEST_USER, 'c@test.com'))
  })

  it('unprotectSenders removes entries', () => {
    protectSenders(TEST_USER, ['x@test.com', 'y@test.com'])
    unprotectSenders(TEST_USER, ['x@test.com'])
    assert.ok(!isProtected(TEST_USER, 'x@test.com'))
    assert.ok(isProtected(TEST_USER, 'y@test.com'))
  })

  it('isProtected is case-insensitive', () => {
    protectSenders(TEST_USER, ['Case@Test.COM'])
    assert.ok(isProtected(TEST_USER, 'case@test.com'))
  })
})
