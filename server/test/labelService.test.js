import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { setDbForTesting, resetDbForTesting } from '../src/db/db.js'
import { encryptTokens } from '../src/db/crypto.js'
import { google } from 'googleapis'
import { runApplyLabelToFilter } from '../src/services/labelService.js'

const TEST_USER = 'test-label-user'

describe('labelService query labeling', () => {
  let store = {
    preferences: { user_id: TEST_USER, label_prefix: 'Unsub/' },
    registry: []
  }

  beforeEach(() => {
    store.preferences = { user_id: TEST_USER, label_prefix: 'Unsub/' }
    store.registry = []

    const mockSql = async (strings, ...values) => {
      const queryStr = strings.join('?')
      if (queryStr.includes('FROM tokens')) {
        return [encryptTokens({ access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' })]
      }
      if (queryStr.includes('FROM preferences') && queryStr.includes('SELECT')) {
        return [store.preferences]
      }
      if (queryStr.includes('INSERT INTO preferences') || queryStr.includes('UPDATE preferences')) {
        if (values[1] !== undefined && typeof values[1] === 'string' && values[1].includes('/')) {
          store.preferences.label_prefix = values[1]
        }
        return []
      }
      if (queryStr.includes('FROM label_registry') && queryStr.includes('SELECT')) {
        return store.registry
      }
      if (queryStr.includes('INSERT INTO label_registry')) {
        store.registry.push({
          user_id: values[0],
          label_name: values[1],
          gmail_id: values[2]
        })
        return []
      }
      return []
    }
    setDbForTesting(mockSql)
  })

  afterEach(() => {
    resetDbForTesting()
  })

  it('runApplyLabelToFilter: creates and applies label with configured prefix', async () => {
    store.preferences.label_prefix = 'TestPrefix/'

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
    assert.ok(store.registry.length > 0)
    assert.equal(store.registry[0].label_name, 'TestPrefix/CustomLabel')
    assert.equal(store.registry[0].gmail_id, 'NEW_LABEL_ID')
  })

  it('runApplyLabelToFilter: archives tagged emails when archive option is set', async () => {
    let archiveTriggered = false

    mock.method(google, 'gmail', () => {
      return {
        users: {
          messages: {
            list: async ({ q }) => ({
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
