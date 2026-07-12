import { describe, it, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { getDb } from '../src/db/db.js'
import { encryptTokens } from '../src/db/crypto.js'
import { google } from 'googleapis'
import { runApplyLabelToFilter } from '../src/services/labelService.js'

const TEST_USER = 'test-label-user'

describe('labelService query labeling', () => {
  before(() => {
    const db = getDb()
    db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').run(TEST_USER, 'testlabel@x.com')
    const { encrypted, iv } = encryptTokens({ access_token: 'fake-access', refresh_token: 'fake-refresh' })
    db.prepare('INSERT OR IGNORE INTO tokens (user_id, encrypted, iv) VALUES (?, ?, ?)').run(TEST_USER, encrypted, iv)
  })

  beforeEach(() => {
    const db = getDb()
    db.prepare('DELETE FROM label_registry WHERE user_id = ?').run(TEST_USER)
    db.prepare('DELETE FROM preferences WHERE user_id = ?').run(TEST_USER)
  })

  it('runApplyLabelToFilter: creates and applies label with configured prefix', async () => {
    const db = getDb()
    db.prepare("INSERT INTO preferences (user_id, label_prefix) VALUES (?, 'TestPrefix/')").run(TEST_USER)

    let createCalled = false
    let batchModifyCalled = false
    let createdName = ''
    let listMessagesCalled = false

    mock.method(google, 'gmail', () => {
      return {
        users: {
          messages: {
            list: async ({ q }) => {
              listMessagesCalled = true
              assert.equal(q, 'subject:test')
              return {
                data: {
                  messages: [{ id: 'msg-1' }, { id: 'msg-2' }]
                }
              }
            },
            batchModify: async ({ requestBody }) => {
              batchModifyCalled = true
              assert.deepEqual(requestBody.addLabelIds, ['NEW_LABEL_ID'])
              assert.equal(requestBody.removeLabelIds, undefined)
              assert.deepEqual(requestBody.ids, ['msg-1', 'msg-2'])
              return {}
            }
          },
          labels: {
            list: async () => ({ data: { labels: [] } }),
            create: async ({ requestBody }) => {
              createCalled = true
              createdName = requestBody.name
              return { data: { id: 'NEW_LABEL_ID', name: requestBody.name } }
            },
          }
        }
      }
    })

    const emit = () => {}
    const res = await runApplyLabelToFilter(TEST_USER, { query: 'subject:test', labelName: 'CustomLabel', archive: false }, emit)

    assert.equal(res.labeled, 2)
    assert.equal(res.total, 2)
    assert.equal(res.capped, false)
    assert.ok(listMessagesCalled)
    assert.ok(createCalled)
    assert.equal(createdName, 'TestPrefix/CustomLabel')
    assert.ok(batchModifyCalled)

    // Check it is registered in the DB
    const row = db.prepare('SELECT * FROM label_registry WHERE user_id = ?').get(TEST_USER)
    assert.ok(row)
    assert.equal(row.label_name, 'TestPrefix/CustomLabel')
    assert.equal(row.gmail_id, 'NEW_LABEL_ID')
  })

  it('runApplyLabelToFilter: archives tagged emails when archive option is set', async () => {
    let archiveTriggered = false

    mock.method(google, 'gmail', () => {
      return {
        users: {
          messages: {
            list: async () => ({
              data: {
                messages: [{ id: 'msg-1' }]
              }
            }),
            batchModify: async ({ requestBody }) => {
              if (requestBody.removeLabelIds && requestBody.removeLabelIds.includes('INBOX')) {
                archiveTriggered = true
              }
              return {}
            }
          },
          labels: {
            list: async () => ({ data: { labels: [{ id: 'EXISTING_ID', name: 'Unsub/CustomLabel' }] } }),
          }
        }
      }
    })

    const emit = () => {}
    const res = await runApplyLabelToFilter(TEST_USER, { query: 'subject:test', labelName: 'CustomLabel', archive: true }, emit)

    assert.equal(res.labeled, 1)
    assert.ok(archiveTriggered)
  })

  it('runApplyLabelToFilter: caps at 5,000 messages and flags capped', async () => {
    let callCount = 0

    mock.method(google, 'gmail', () => {
      return {
        users: {
          messages: {
            list: async ({ pageToken }) => {
              callCount++
              // Return 2500 per page to test paging and capping
              if (callCount === 1) {
                return {
                  data: {
                    messages: Array.from({ length: 2500 }, (_, i) => ({ id: `msg-${i}` })),
                    nextPageToken: 'page-2'
                  }
                }
              } else if (callCount === 2) {
                return {
                  data: {
                    messages: Array.from({ length: 2500 }, (_, i) => ({ id: `msg-${i + 2500}` })),
                    nextPageToken: 'page-3'
                  }
                }
              } else {
                return {
                  data: {
                    messages: [{ id: 'msg-over-limit' }]
                  }
                }
              }
            },
            batchModify: async () => ({})
          },
          labels: {
            list: async () => ({ data: { labels: [{ id: 'EXISTING_ID', name: 'Unsub/CustomLabel' }] } }),
          }
        }
      }
    })

    const emit = () => {}
    const res = await runApplyLabelToFilter(TEST_USER, { query: 'subject:test', labelName: 'CustomLabel', archive: false }, emit)

    assert.equal(res.labeled, 5000)
    assert.equal(res.total, 5001)
    assert.equal(res.capped, true)
  })
})
