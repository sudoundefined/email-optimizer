import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const TEST_PATH = path.join(import.meta.dirname, '..', 'data', 'test-protected-senders.json')

import {
  PROTECTED_DOMAINS,
  PROTECTED_SUBJECT_KEYWORDS,
  matchesDomainHeuristic,
  matchesSubjectHeuristic,
  autoProtectFromScan,
  listProtected,
  protectSenders,
  unprotectSenders,
  isProtected,
  _setPathForTest,
} from '../src/services/protectService.js'

describe('protectService', () => {
  before(async () => {
    _setPathForTest(TEST_PATH)
    try { await fs.unlink(TEST_PATH) } catch {}
  })
  after(async () => {
    try { await fs.unlink(TEST_PATH) } catch {}
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
    await protectSenders(['a@test.com', 'b@test.com'])
    const list = await listProtected()
    assert.equal(list.length, 2)
    assert.ok(await isProtected('a@test.com'))
    assert.ok(!(await isProtected('c@test.com')))
  })

  it('unprotectSenders removes entries', async () => {
    await protectSenders(['x@test.com', 'y@test.com'])
    await unprotectSenders(['x@test.com'])
    assert.ok(!(await isProtected('x@test.com')))
    assert.ok(await isProtected('y@test.com'))
  })

  it('isProtected is case-insensitive', async () => {
    await protectSenders(['Case@Test.COM'])
    assert.ok(await isProtected('case@test.com'))
  })
})
