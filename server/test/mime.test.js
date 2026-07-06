import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMailto, buildUnsubscribeEmail, base64url, sanitizeHeaderValue } from '../src/gmail/mime.js'

test('parseMailto: plain address defaults subject/body to unsubscribe', () => {
  const r = parseMailto('mailto:unsub@acme.com')
  assert.deepEqual(r, { to: 'unsub@acme.com', subject: 'unsubscribe', body: 'unsubscribe' })
})

test('parseMailto: subject and body params decoded', () => {
  const r = parseMailto('mailto:u@a.com?subject=Remove%20me&body=please%20remove')
  assert.equal(r.subject, 'Remove me')
  assert.equal(r.body, 'please remove')
})

test('parseMailto: rejects non-mailto and invalid addresses', () => {
  assert.equal(parseMailto('https://a.com'), null)
  assert.equal(parseMailto('mailto:notanaddress'), null)
  assert.equal(parseMailto(''), null)
})

test('sanitizeHeaderValue strips CRLF (header injection)', () => {
  assert.equal(sanitizeHeaderValue('evil\r\nBcc: victim@x.com'), 'evil Bcc: victim@x.com')
})

test('buildUnsubscribeEmail: header injection via subject param is neutralized', () => {
  const raw = buildUnsubscribeEmail({
    to: 'u@a.com',
    subject: 'unsub\r\nBcc: victim@x.com',
    body: 'unsubscribe',
  })
  const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  const headerSection = decoded.split('\r\n\r\n')[0]
  assert.ok(!/^Bcc:/im.test(headerSection), 'no injected Bcc header')
  assert.match(decoded, /^To: u@a\.com\r\n/)
})

test('base64url: RFC 4648 url-safe alphabet, no padding', () => {
  const encoded = base64url('any??>>~~ input')
  assert.ok(!encoded.includes('+') && !encoded.includes('/') && !encoded.includes('='))
  assert.equal(
    Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    'any??>>~~ input'
  )
})
