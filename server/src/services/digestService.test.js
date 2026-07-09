import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  diffNewSenders,
  buildDigestHtml,
  buildDigestText,
  buildDigestEmail,
  escapeHtml,
} from './digestService.js'

const sender = (over) => ({
  email: 'a@shop.com',
  name: 'Shop',
  messageCount: 5,
  unsubscribe: { method: 'link', linkUrl: 'https://shop.com/unsub' },
  ...over,
})

describe('digestService diffNewSenders', () => {
  it('returns only senders not in the known set', () => {
    const senders = [sender({ email: 'a@x.com' }), sender({ email: 'b@y.com' })]
    const res = diffNewSenders(senders, ['a@x.com'])
    assert.equal(res.length, 1)
    assert.equal(res[0].email, 'b@y.com')
  })

  it('is case-insensitive on the known set', () => {
    const res = diffNewSenders([sender({ email: 'New@X.com' })], ['new@x.com'])
    assert.equal(res.length, 0)
  })

  it('excludes senders with no unsubscribe method when marketingOnly (default)', () => {
    const senders = [
      sender({ email: 'a@x.com', unsubscribe: { method: 'none' } }),
      sender({ email: 'b@y.com', unsubscribe: { method: 'oneclick', oneClickUrl: 'https://y.com/u' } }),
    ]
    const res = diffNewSenders(senders, [])
    assert.deepEqual(res.map((r) => r.email), ['b@y.com'])
  })

  it('includes no-method senders when marketingOnly:false', () => {
    const res = diffNewSenders([sender({ unsubscribe: { method: 'none' } })], [], { marketingOnly: false })
    assert.equal(res.length, 1)
  })

  it('sorts by messageCount desc and surfaces a usable unsub url', () => {
    const senders = [
      sender({ email: 'a@x.com', messageCount: 2 }),
      sender({ email: 'b@y.com', messageCount: 9, unsubscribe: { method: 'oneclick', oneClickUrl: 'https://y/u' } }),
    ]
    const res = diffNewSenders(senders, [])
    assert.equal(res[0].email, 'b@y.com')
    assert.equal(res[0].unsubUrl, 'https://y/u')
    assert.equal(res[1].unsubUrl, 'https://shop.com/unsub')
  })
})

describe('digestService HTML/text builders', () => {
  it('escapeHtml neutralizes markup', () => {
    assert.equal(escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;')
  })

  it('buildDigestHtml escapes sender name/email/url (XSS-safe)', () => {
    const html = buildDigestHtml({
      newSenders: [{ email: 'x@evil.com', name: '<script>alert(1)</script>', messageCount: 1, method: 'link', unsubUrl: 'https://e.com/"><img>' }],
      accountEmail: 'me@x.com',
    })
    assert.ok(!html.includes('<script>alert(1)</script>'))
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(!html.includes('"><img>'))
  })

  it('buildDigestHtml renders an unsubscribe link when a url exists, method label otherwise', () => {
    const withUrl = buildDigestHtml({ newSenders: [{ email: 'a@x.com', name: 'A', messageCount: 1, method: 'link', unsubUrl: 'https://a/u' }] })
    assert.ok(withUrl.includes('href="https://a/u"'))
    const noUrl = buildDigestHtml({ newSenders: [{ email: 'a@x.com', name: 'A', messageCount: 1, method: 'mailto', unsubUrl: null }] })
    assert.ok(noUrl.includes('Email')) // METHOD_LABEL for mailto
    assert.ok(!noUrl.includes('href='))
  })

  it('buildDigestText lists senders with actions', () => {
    const txt = buildDigestText({ newSenders: [{ email: 'a@x.com', name: 'A', messageCount: 3, method: 'link', unsubUrl: 'https://a/u' }], appUrl: 'http://localhost:5173' })
    assert.ok(txt.includes('A <a@x.com> — 3 emails — unsubscribe: https://a/u'))
    assert.ok(txt.includes('http://localhost:5173'))
  })
})

describe('digestService buildDigestEmail', () => {
  it('produces base64url with multipart headers and no CRLF header injection', () => {
    const raw = buildDigestEmail({
      to: 'me@x.com\r\nBcc: evil@x.com',
      from: 'me@x.com',
      subject: 'Digest\r\nX-Injected: yes',
      html: '<p>hi</p>',
      text: 'hi',
    })
    // base64url alphabet only
    assert.match(raw, /^[A-Za-z0-9_-]+$/)
    const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    assert.ok(decoded.includes('multipart/alternative'))
    assert.ok(decoded.includes('<p>hi</p>'))
    // injected header/Bcc must have been flattened out of the header lines
    assert.ok(!/^Bcc:/m.test(decoded))
    assert.ok(!/^X-Injected:/m.test(decoded))
  })
})
