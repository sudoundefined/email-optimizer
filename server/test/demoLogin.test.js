import { test } from 'node:test'
import assert from 'node:assert'
import { authController } from '../src/controllers/authController.js'
import { COOKIE_NAME } from '../src/middleware/auth.js'

test('authController.demoLogin sets cookie and returns demo user state', async () => {
  let setCookieArgs = null
  const req = {}
  const res = {
    cookie(name, val, opts) {
      setCookieArgs = { name, val, opts }
    },
    json(data) {
      this.data = data
      return this
    }
  }
  const next = (err) => { throw err }

  await authController.demoLogin(req, res, next)

  assert.ok(setCookieArgs, 'Should call res.cookie')
  assert.strictEqual(setCookieArgs.name, COOKIE_NAME)
  assert.ok(setCookieArgs.val, 'Cookie should have a JWT token value')
  assert.strictEqual(setCookieArgs.opts.httpOnly, true)

  assert.strictEqual(res.data.ok, true)
  assert.strictEqual(res.data.user.email, 'demo.personal@gmail.com')
  assert.strictEqual(res.data.user.preferences.labelPrefix, 'Unsub/')
})
