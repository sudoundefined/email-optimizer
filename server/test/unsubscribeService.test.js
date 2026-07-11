import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import dns from 'node:dns/promises'
import { isPrivateIp, assertSafeUrl, pinnedLookup } from '../src/services/unsubscribeService.js'

test('isPrivateIp: blocks private IPv4 ranges', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true)
  assert.equal(isPrivateIp('10.0.0.1'), true)
  assert.equal(isPrivateIp('192.168.1.100'), true)
  assert.equal(isPrivateIp('172.16.0.1'), true)
  assert.equal(isPrivateIp('169.254.169.254'), true)
  assert.equal(isPrivateIp('0.0.0.0'), true)
  assert.equal(isPrivateIp('100.64.0.1'), true)
})

test('isPrivateIp: allows public IPv4 addresses', () => {
  assert.equal(isPrivateIp('8.8.8.8'), false)
  assert.equal(isPrivateIp('1.1.1.1'), false)
  assert.equal(isPrivateIp('142.250.190.46'), false)
})

test('isPrivateIp: blocks loopback and IPv4-mapped IPv6 addresses', () => {
  assert.equal(isPrivateIp('::1'), true)
  assert.equal(isPrivateIp('::'), true)
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateIp('::ffff:169.254.169.254'), true)
  assert.equal(isPrivateIp('::ffff:10.0.0.1'), true)
  assert.equal(isPrivateIp('fe80::1'), true)
})

test('isPrivateIp: allows public IPv6 addresses', () => {
  assert.equal(isPrivateIp('2001:4860:4860::8888'), false)
  assert.equal(isPrivateIp('::ffff:8.8.8.8'), false)
})

test('assertSafeUrl: rejects non-https URLs', async () => {
  await assert.rejects(
    async () => assertSafeUrl('http://example.com/unsub'),
    /one-click URL must be https/
  )
})

test('assertSafeUrl: rejects private IP addresses and localhost', async () => {
  await assert.rejects(
    async () => assertSafeUrl('https://127.0.0.1/unsub'),
    /URL resolves to a private address/
  )
  await assert.rejects(
    async () => assertSafeUrl('https://localhost/unsub'),
    /URL resolves to a private address/
  )
  await assert.rejects(
    async () => assertSafeUrl('https://[::ffff:127.0.0.1]/unsub'),
    /URL resolves to a private address/
  )
})

test('assertSafeUrl: returns the address/family literal for an IP-literal https URL', async () => {
  const result = await assertSafeUrl('https://93.184.216.34/unsub')
  assert.deepEqual(result, { address: '93.184.216.34', family: 4 })
})

test('assertSafeUrl: resolves a hostname via dns.lookup and returns the validated address (no real network call)', async () => {
  mock.method(dns, 'lookup', async (host) => {
    assert.equal(host, 'sender.example.com')
    return { address: '93.184.216.34', family: 4 }
  })
  const result = await assertSafeUrl('https://sender.example.com/unsub')
  assert.deepEqual(result, { address: '93.184.216.34', family: 4 })
})

test('assertSafeUrl: rejects a hostname whose resolved address is private (mocked dns.lookup, no real network call)', async () => {
  mock.method(dns, 'lookup', async () => ({ address: '169.254.169.254', family: 4 }))
  await assert.rejects(
    async () => assertSafeUrl('https://rebind.attacker.test/unsub'),
    /URL resolves to a private address/
  )
  mock.restoreAll()
})

test('pinnedLookup: calls back with the pinned address (single-address form)', () => {
  const lookup = pinnedLookup('93.184.216.34', 4)
  let seen
  lookup('ignored-hostname', {}, (err, address, family) => {
    seen = { err, address, family }
  })
  assert.equal(seen.err, null)
  assert.equal(seen.address, '93.184.216.34')
  assert.equal(seen.family, 4)
})

test('pinnedLookup: calls back with the array form when options.all is set (Node happy-eyeballs)', () => {
  const lookup = pinnedLookup('93.184.216.34', 4)
  let seen
  lookup('ignored-hostname', { all: true }, (err, records) => {
    seen = { err, records }
  })
  assert.equal(seen.err, null)
  assert.deepEqual(seen.records, [{ address: '93.184.216.34', family: 4 }])
})

test('pinnedLookup: rejects (defense in depth) when constructed with a private pinned address', () => {
  const lookup = pinnedLookup('127.0.0.1', 4)
  let seenErr
  lookup('ignored-hostname', {}, (err) => {
    seenErr = err
  })
  assert.match(seenErr.message, /URL resolves to a private address/)
})
