import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken } from '../src/auth/jwt.js'
import { config } from '../src/config.js'

test('signToken and verifyToken round-trip with HS256', () => {
  const token = signToken('user-123')
  const decoded = verifyToken(token)
  assert.equal(decoded.sub, 'user-123')
})

test('verifyToken rejects tokens signed with ' + 'none' + ' algorithm or none header', () => {
  // Forge a token with algorithm 'none'
  const forged = jwt.sign({ sub: 'attacker' }, '', { algorithm: 'none' })
  assert.throws(() => verifyToken(forged))
})
