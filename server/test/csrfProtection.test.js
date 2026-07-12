import { test } from 'node:test'
import assert from 'node:assert/strict'

function normalizeOrigin(urlStr) {
  return String(urlStr || '').replace(/\/+$/, '').toLowerCase()
}

test('normalizeOrigin: strips trailing slashes and lowercases origin strings', () => {
  assert.equal(normalizeOrigin('http://localhost:5173/'), 'http://localhost:5173')
  assert.equal(normalizeOrigin('HTTP://LOCALHOST:5173///'), 'http://localhost:5173')
  assert.equal(normalizeOrigin('https://example.com'), 'https://example.com')
  assert.equal(normalizeOrigin(''), '')
})
