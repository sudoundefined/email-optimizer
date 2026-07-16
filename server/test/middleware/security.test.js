import { test, describe } from 'node:test'
import assert from 'node:assert'
import { isPrivateIp, validateExternalUrl, securityHeaders } from '../../src/middleware/security.js'

describe('Security Middleware & SSRF Defense Unit Tests', () => {
  test('isPrivateIp detects loopback and RFC 1918 addresses', () => {
    assert.strictEqual(isPrivateIp('127.0.0.1'), true)
    assert.strictEqual(isPrivateIp('10.0.0.5'), true)
    assert.strictEqual(isPrivateIp('192.168.1.100'), true)
    assert.strictEqual(isPrivateIp('172.16.0.1'), true)
    assert.strictEqual(isPrivateIp('169.254.169.254'), true)
    assert.strictEqual(isPrivateIp('8.8.8.8'), false)
    assert.strictEqual(isPrivateIp('1.1.1.1'), false)
  })

  test('validateExternalUrl blocks HTTP (non-HTTPS) URLs', async () => {
    await assert.rejects(
      async () => validateExternalUrl('http://example.com/unsub'),
      { message: /Only HTTPS URLs are permitted/ }
    )
  })

  test('validateExternalUrl blocks localhost and loopback IP URLs', async () => {
    await assert.rejects(
      async () => validateExternalUrl('https://localhost/unsub'),
      { message: /Hostname "localhost" is blocked/ }
    )
    await assert.rejects(
      async () => validateExternalUrl('https://127.0.0.1/unsub'),
      { message: /in a private\/loopback range/ }
    )
    await assert.rejects(
      async () => validateExternalUrl('https://169.254.169.254/latest/meta-data/'),
      { message: /in a private\/loopback range/ }
    )
  })

  test('securityHeaders sets expected headers on response', () => {
    const headers = {}
    const mockRes = {
      setHeader(k, v) { headers[k] = v }
    }
    let nextCalled = false
    securityHeaders({}, mockRes, () => { nextCalled = true })

    assert.strictEqual(nextCalled, true)
    assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff')
    assert.strictEqual(headers['X-Frame-Options'], 'DENY')
  })
})
