import { test } from 'node:test'
import assert from 'node:assert'
import { getMockGmailClient, getMockState, resetMockState } from '../src/gmail/mockClient.js'

test('MockGmailClient getProfile returns demo account info', async () => {
  resetMockState('acc_demo_personal')
  const client = getMockGmailClient('acc_demo_personal')
  const res = await client.users.getProfile()
  assert.strictEqual(res.data.emailAddress, 'demo.personal@gmail.com')
  assert.ok(res.data.messagesTotal > 1500, 'Should have over 1500 simulated messages')
})

test('MockGmailClient list filters by query and pagination', async () => {
  resetMockState('acc_demo_personal')
  const client = getMockGmailClient('acc_demo_personal')
  
  // List all messages (page size 50)
  const listRes = await client.users.messages.list({ maxResults: 50 })
  assert.strictEqual(listRes.data.messages.length, 50)
  assert.ok(listRes.data.nextPageToken, 'Should return nextPageToken')

  // Filter by from:amazon.com
  const amazonRes = await client.users.messages.list({ q: 'from:amazon.com' })
  assert.ok(amazonRes.data.messages.length > 0, 'Should return amazon messages')

  // Filter by larger:10M
  const largeRes = await client.users.messages.list({ q: 'larger:10M' })
  assert.ok(largeRes.data.messages.length > 0, 'Should return large attachment messages')
})

test('MockGmailClient get returns full headers and metadata', async () => {
  const client = getMockGmailClient('acc_demo_personal')
  const listRes = await client.users.messages.list({ maxResults: 1 })
  const msgId = listRes.data.messages[0].id

  const getRes = await client.users.messages.get({ id: msgId })
  assert.strictEqual(getRes.data.id, msgId)
  assert.ok(Array.isArray(getRes.data.payload.headers), 'Headers should be an array')
  const fromHeader = getRes.data.payload.headers.find(h => h.name.toLowerCase() === 'from')
  assert.ok(fromHeader && fromHeader.value, 'Should include From header')
})

test('MockGmailClient batchModify updates labelIds', async () => {
  const client = getMockGmailClient('acc_demo_personal')
  const listRes = await client.users.messages.list({ maxResults: 2 })
  const ids = listRes.data.messages.map(m => m.id)

  await client.users.messages.batchModify({
    requestBody: {
      ids,
      addLabelIds: ['TRASH'],
      removeLabelIds: ['INBOX']
    }
  })

  const getRes = await client.users.messages.get({ id: ids[0] })
  assert.ok(getRes.data.labelIds.includes('TRASH'), 'Should add TRASH label')
  assert.ok(!getRes.data.labelIds.includes('INBOX'), 'Should remove INBOX label')
})

test('MockGmailClient labels list, create, and delete', async () => {
  const client = getMockGmailClient('acc_demo_personal')
  const listRes = await client.users.labels.list()
  assert.ok(listRes.data.labels.length >= 5, 'Should return default system & user labels')

  const createRes = await client.users.labels.create({ requestBody: { name: 'Unsub/TestLabel' } })
  assert.strictEqual(createRes.data.name, 'Unsub/TestLabel')
  const newId = createRes.data.id

  const afterCreate = await client.users.labels.list()
  assert.ok(afterCreate.data.labels.some(l => l.id === newId), 'Should include new label')

  await client.users.labels.delete({ id: newId })
  const afterDelete = await client.users.labels.list()
  assert.ok(!afterDelete.data.labels.some(l => l.id === newId), 'Should remove deleted label')
})
