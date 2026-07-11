import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateIp, assertSafeUrl } from '../src/services/unsubscribeService.js'

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
