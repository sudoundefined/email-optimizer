import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFrom,
  parseListUnsubscribe,
  isOneClickPost,
  unsubscribeInfo,
} from '../src/services/headerParser.js'

test('parseFrom: quoted display name with angle address', () => {
  assert.deepEqual(parseFrom('"Acme Deals" <deals@acme.com>'), {
    name: 'Acme Deals',
    email: 'deals@acme.com',
  })
})

test('parseFrom: unquoted display name', () => {
  assert.deepEqual(parseFrom('Acme Deals <Deals@Acme.COM>'), {
    name: 'Acme Deals',
    email: 'deals@acme.com',
  })
})

test('parseFrom: bare address', () => {
  assert.deepEqual(parseFrom('deals@acme.com'), { name: '', email: 'deals@acme.com' })
})

test('parseFrom: RFC 2047 B-encoded name', () => {
  const { name, email } = parseFrom('=?UTF-8?B?QWNtw6kgRGVhbHM=?= <deals@acme.com>')
  assert.equal(name, 'Acmé Deals')
  assert.equal(email, 'deals@acme.com')
})

test('parseFrom: RFC 2047 Q-encoded name', () => {
  const { name } = parseFrom('=?utf-8?Q?Acm=C3=A9_Deals?= <deals@acme.com>')
  assert.equal(name, 'Acmé Deals')
})

test('parseFrom: empty and garbage input', () => {
  assert.deepEqual(parseFrom(''), { name: '', email: '' })
  assert.deepEqual(parseFrom(undefined), { name: '', email: '' })
  assert.equal(parseFrom('not an address').email, '')
})

test('parseListUnsubscribe: mailto + https pair', () => {
  const r = parseListUnsubscribe('<mailto:unsub@acme.com>, <https://acme.com/unsub?u=1>')
  assert.equal(r.mailto, 'mailto:unsub@acme.com')
  assert.equal(r.https, 'https://acme.com/unsub?u=1')
})

test('parseListUnsubscribe: folded whitespace and newlines', () => {
  const r = parseListUnsubscribe('<https://a.com/u>,\r\n\t<mailto:u@a.com>')
  assert.equal(r.https, 'https://a.com/u')
  assert.equal(r.mailto, 'mailto:u@a.com')
})

test('parseListUnsubscribe: missing angle brackets', () => {
  const r = parseListUnsubscribe('https://a.com/unsub, mailto:u@a.com')
  assert.equal(r.https, 'https://a.com/unsub')
  assert.equal(r.mailto, 'mailto:u@a.com')
})

test('parseListUnsubscribe: http-only link', () => {
  const r = parseListUnsubscribe('<http://a.com/unsub>')
  assert.equal(r.http, 'http://a.com/unsub')
  assert.equal(r.https, undefined)
})

test('parseListUnsubscribe: empty → null', () => {
  assert.equal(parseListUnsubscribe(''), null)
  assert.equal(parseListUnsubscribe(undefined), null)
  assert.equal(parseListUnsubscribe('garbage with no uris'), null)
})

test('isOneClickPost: case-insensitive exact match', () => {
  assert.ok(isOneClickPost('List-Unsubscribe=One-Click'))
  assert.ok(isOneClickPost('  list-unsubscribe=one-click  '))
  assert.ok(!isOneClickPost('List-Unsubscribe=One-Click; extra'))
  assert.ok(!isOneClickPost(''))
})

test('unsubscribeInfo: one-click requires https AND the Post header', () => {
  const oneclick = unsubscribeInfo({
    'list-unsubscribe': '<https://a.com/u>',
    'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
  })
  assert.equal(oneclick.method, 'oneclick')
  assert.equal(oneclick.oneClickUrl, 'https://a.com/u')

  // Post header without https URI → not one-click
  const mailtoOnly = unsubscribeInfo({
    'list-unsubscribe': '<mailto:u@a.com>',
    'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
  })
  assert.equal(mailtoOnly.method, 'mailto')

  // https without Post header → link (or mailto when present)
  const linkOnly = unsubscribeInfo({ 'list-unsubscribe': '<https://a.com/u>' })
  assert.equal(linkOnly.method, 'link')
})

test('unsubscribeInfo: mailto preferred over bare link', () => {
  const r = unsubscribeInfo({ 'list-unsubscribe': '<mailto:u@a.com>, <https://a.com/u>' })
  assert.equal(r.method, 'mailto')
  assert.equal(r.linkUrl, 'https://a.com/u')
})

test('unsubscribeInfo: no header → none', () => {
  assert.equal(unsubscribeInfo({}).method, 'none')
})
