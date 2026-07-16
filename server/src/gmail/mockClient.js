import { generateMockMessages, DEMO_ACCOUNTS } from './mockDataset.js'

// In-memory state for mock client across sessions so label additions/removals and deletions persist during local testing
const mockStateByUser = new Map()

export function getMockState(userId) {
  const userIdKey = String(userId).startsWith('acc_demo_') ? String(userId) : 'acc_demo_personal'
  if (!mockStateByUser.has(userIdKey)) {
    const messages = generateMockMessages(userIdKey)
    const labels = [
      { id: 'INBOX', name: 'INBOX', type: 'system', messagesTotal: messages.length, messagesUnread: 0 },
      { id: 'TRASH', name: 'TRASH', type: 'system', messagesTotal: 0, messagesUnread: 0 },
      { id: 'SPAM', name: 'SPAM', type: 'system', messagesTotal: 0, messagesUnread: 0 },
      { id: 'mock_lbl_newsletters', name: 'Unsub/Newsletters', type: 'user', messagesTotal: 250, messagesUnread: 0 },
      { id: 'mock_lbl_promotions', name: 'Unsub/Promotions', type: 'user', messagesTotal: 320, messagesUnread: 0 },
    ]
    mockStateByUser.set(userIdKey, { messages, labels, labelCounter: 100 })
  }
  return mockStateByUser.get(userIdKey)
}

export function resetMockState(userId) {
  const userIdKey = String(userId).startsWith('acc_demo_') ? String(userId) : 'acc_demo_personal'
  mockStateByUser.delete(userIdKey)
  return getMockState(userIdKey)
}

export function getMockGmailClient(userId) {
  return {
    users: {
      getProfile: async () => {
        const acc = DEMO_ACCOUNTS.find(a => a.id === userId) || DEMO_ACCOUNTS[0]
        const state = getMockState(userId)
        return {
          data: {
            emailAddress: acc.email,
            messagesTotal: state.messages.length,
            threadsTotal: Math.floor(state.messages.length / 2),
            historyId: '123456789'
          }
        }
      },

      labels: {
        list: async () => {
          const state = getMockState(userId)
          return { data: { labels: state.labels } }
        },
        get: async ({ id }) => {
          const state = getMockState(userId)
          const found = state.labels.find(l => l.id === id)
          if (!found) {
            const err = new Error('Label not found')
            err.code = 404
            throw err
          }
          return { data: found }
        },
        create: async ({ requestBody }) => {
          const state = getMockState(userId)
          const newId = `mock_lbl_${++state.labelCounter}`
          const newLabel = {
            id: newId,
            name: requestBody.name,
            type: 'user',
            messagesTotal: 0,
            messagesUnread: 0
          }
          state.labels.push(newLabel)
          return { data: newLabel }
        },
        delete: async ({ id }) => {
          const state = getMockState(userId)
          state.labels = state.labels.filter(l => l.id !== id)
          for (const m of state.messages) {
            if (m.labelIds) m.labelIds = m.labelIds.filter(lid => lid !== id)
          }
          return { data: {} }
        }
      },

      messages: {
        list: async ({ q = '', maxResults = 100, pageToken, labelIds }) => {
          const state = getMockState(userId)
          let filtered = state.messages

          if (labelIds && labelIds.length > 0) {
            filtered = filtered.filter(m => labelIds.every(lid => m.labelIds.includes(lid)))
          }

          if (q) {
            const query = q.toLowerCase()
            if (query.includes('in:trash')) {
              filtered = filtered.filter(m => m.labelIds.includes('TRASH'))
            } else if (!query.includes('in:anywhere') && !labelIds?.includes('TRASH')) {
              filtered = filtered.filter(m => !m.labelIds.includes('TRASH'))
            }

            if (query.includes('from:')) {
              const match = query.match(/from:([^\s]+)/)
              if (match && match[1]) {
                const fromTerm = match[1].replace(/["']/g, '')
                filtered = filtered.filter(m => (m.headers.from || '').toLowerCase().includes(fromTerm))
              }
            }

            if (query.includes('larger:')) {
              const match = query.match(/larger:(\d+)([kmg]?)/i)
              if (match) {
                let size = Number(match[1])
                const unit = (match[2] || '').toLowerCase()
                if (unit === 'k') size *= 1024
                else if (unit === 'm') size *= 1024 * 1024
                else if (unit === 'g') size *= 1024 * 1024 * 1024
                filtered = filtered.filter(m => m.sizeEstimate >= size)
              }
            }
          } else if (!labelIds?.includes('TRASH')) {
            filtered = filtered.filter(m => !m.labelIds.includes('TRASH'))
          }

          const startIndex = pageToken ? Number(pageToken) || 0 : 0
          const slice = filtered.slice(startIndex, startIndex + maxResults)
          const nextPage = startIndex + maxResults < filtered.length ? String(startIndex + maxResults) : undefined

          return {
            data: {
              messages: slice.map(m => ({ id: m.id, threadId: m.threadId })),
              nextPageToken: nextPage,
              resultSizeEstimate: filtered.length
            }
          }
        },

        get: async ({ id }) => {
          const state = getMockState(userId)
          const msg = state.messages.find(m => m.id === id)
          if (!msg) {
            const err = new Error('Message not found')
            err.code = 404
            throw err
          }

          const headersArr = Object.entries(msg.headers).map(([name, value]) => ({ name, value }))
          return {
            data: {
              id: msg.id,
              threadId: msg.threadId,
              labelIds: msg.labelIds,
              sizeEstimate: msg.sizeEstimate,
              internalDate: String(msg.internalDate),
              payload: {
                headers: headersArr
              }
            }
          }
        },

        batchModify: async ({ requestBody }) => {
          const state = getMockState(userId)
          const { ids = [], addLabelIds = [], removeLabelIds = [] } = requestBody || {}
          const idSet = new Set(ids)

          for (const msg of state.messages) {
            if (idSet.has(msg.id)) {
              const current = new Set(msg.labelIds)
              for (const r of removeLabelIds) current.delete(r)
              for (const a of addLabelIds) current.add(a)
              msg.labelIds = [...current]
            }
          }
          return { data: {} }
        },

        batchDelete: async ({ requestBody }) => {
          const state = getMockState(userId)
          const { ids = [] } = requestBody || {}
          const idSet = new Set(ids)
          state.messages = state.messages.filter(m => !idSet.has(m.id))
          return { data: {} }
        },

        send: async () => {
          return { data: { id: `mock_sent_${Date.now()}` } }
        }
      }
    }
  }
}
