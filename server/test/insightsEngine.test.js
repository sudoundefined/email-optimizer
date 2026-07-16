import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoringEngine } from '../src/services/insights/scoringEngine.js'
import { insightsEngine } from '../src/services/insights/insightsEngine.js'

const sampleNormalized = {
  totalEmails: 1000,
  totalStorageBytes: 500 * 1024 * 1024,
  totalStorageMB: 500,
  unreadCount: 200,
  senderCount: 50,
  protectedSendersCount: 5,
  importantSendersCount: 10,
  promotionsAndMarketing: 400,
  totalSubscriptionSenders: 15,
  inactiveSubscriptionSenders: 3,
  labeledSenders: 10,
  candidateEmails: 600,
  candidateStorageBytes: 300 * 1024 * 1024,
  candidateStorageMB: 300,
  largeAttachmentsBytes: 100 * 1024 * 1024,
  newslettersBytes: 50 * 1024 * 1024,
  largeMessagesBytes: 50 * 1024 * 1024,
  categoryCounts: { Promotions: 20, Newsletters: 10, Banking: 5 },
  categoryMessages: { Promotions: 400, Newsletters: 200, Banking: 50, Other: 350 },
  categoryStorageBytes: { Promotions: 200 * 1024 * 1024, Newsletters: 100 * 1024 * 1024 },
  recentCleanupSessionsCount: 2,
  cleanupStreakDays: 3,
  senders: [
    { email: 'promo@store.com', displayName: 'Promo Store', messageCount: 150, totalSizeEstimate: 80 * 1024 * 1024, unreadCount: 50 },
    { email: 'bank@chase.com', displayName: 'Chase Bank', messageCount: 20, totalSizeEstimate: 5 * 1024 * 1024, domain: 'chase.com' }
  ]
}

test('scoringEngine calculates bounded 0-100 scores and levels accurately', () => {
  const scores = scoringEngine.calculateScores(sampleNormalized)

  assert.ok(scores.healthScore >= 0 && scores.healthScore <= 100, 'healthScore in bounds')
  assert.ok(['Excellent', 'Good', 'Fair', 'Needs Attention'].includes(scores.healthLevel))
  assert.equal(typeof scores.breakdown.cleanliness, 'number')
  assert.equal(typeof scores.breakdown.readability, 'number')
  assert.equal(typeof scores.breakdown.organization, 'number')
  assert.equal(typeof scores.breakdown.storageEfficiency, 'number')
  assert.equal(typeof scores.breakdown.senderTrust, 'number')
  assert.equal(typeof scores.breakdown.subscriptionHygiene, 'number')
  assert.equal(typeof scores.breakdown.cleanupActivity, 'number')

  assert.equal(scores.cleanupPotential.messages, 600)
  assert.equal(scores.cleanupPotential.storageMB, 300)
  assert.equal(scores.cleanupPotential.percentageOfTotal, 60)
})

test('insightsEngine generates all required widgets with deterministic why explanations and actions', () => {
  const scores = scoringEngine.calculateScores(sampleNormalized)
  const widgets = insightsEngine.generateWidgets(sampleNormalized, scores)

  // 1. Health widget
  assert.equal(widgets.health.id, 'health_score')
  assert.ok(typeof widgets.health.why === 'string' && widgets.health.why.includes('Your mailbox health is'))
  assert.deepEqual(widgets.health.action, { label: 'Improve Health', type: 'navigate', target: '/mailbox' })

  // 2. Top Priorities
  assert.ok(Array.isArray(widgets.topPriorities))
  assert.ok(widgets.topPriorities.length > 0)
  const top = widgets.topPriorities[0]
  assert.ok(top.why.includes('Promo Store') || top.why.includes('promo@store.com'))
  assert.equal(top.action.type, 'filter_and_clean')

  // 3. DNA Widget
  assert.equal(widgets.dna.id, 'mailbox_dna')
  assert.equal(widgets.dna.dominantCategory, 'Promotions')
  assert.equal(widgets.dna.identity, 'Shopping Heavy')
  assert.equal(widgets.dna.action.type, 'filter_category')

  // 4. Promotions Widget
  assert.equal(widgets.promotions.id, 'promotions_alert')
  assert.equal(widgets.promotions.messageCount, 400)
  assert.equal(widgets.promotions.action.target, 'Promotions')

  // 5. Storage Widget
  assert.equal(widgets.storage.id, 'storage_recovery')
  assert.equal(widgets.storage.totalRecoveryMB, 300)

  // 6. Time Saved Widget
  assert.equal(widgets.timeSaved.id, 'time_saved')
  assert.ok(widgets.timeSaved.estimatedMinutes > 0)
  assert.ok(widgets.timeSaved.potentialTimeSavedHours > 0)

  // 7. Streak Widget
  assert.equal(widgets.streak.id, 'cleanup_streak')
  assert.equal(widgets.streak.streakDays, 3)

  // 8. Forecast Widget
  assert.equal(widgets.forecast.id, 'thirty_day_forecast')
  assert.ok(widgets.forecast.predictedGrowthMessages > 0)

  // 9. Achievements
  assert.ok(Array.isArray(widgets.achievements))
  assert.equal(widgets.achievements.length, 7)
  const firstCleanup = widgets.achievements.find(a => a.id === 'first_cleanup')
  assert.equal(firstCleanup.isUnlocked, true)
})
