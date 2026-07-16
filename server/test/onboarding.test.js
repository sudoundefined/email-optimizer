import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setDbForTesting, resetDbForTesting } from '../src/db/db.js'
import { onboardingService } from '../src/services/onboardingService.js'

const TEST_USER = 'test-onboarding-user'

describe('onboardingService workflow & state management', () => {
  let store = {
    preferences: {
      user_id: TEST_USER,
      onboarding_step: 'welcome',
      has_completed_onboarding: false,
      protected_categories: ['Banking', 'Finance', 'Bills']
    },
    senders: []
  }

  beforeEach(() => {
    store.preferences = {
      user_id: TEST_USER,
      onboarding_step: 'welcome',
      has_completed_onboarding: false,
      protected_categories: ['Banking', 'Finance', 'Bills']
    }
    store.senders = []

    const mockSql = async (strings, ...values) => {
      const queryStr = strings.join('?')
      if (queryStr.includes('FROM preferences')) {
        if (queryStr.includes('SELECT')) {
          return [store.preferences]
        }
        if (queryStr.includes('INSERT INTO preferences') || queryStr.includes('UPDATE preferences')) {
          return [store.preferences]
        }
      }
      if (queryStr.includes('preferences') && queryStr.includes('SET')) {
        // SQL query building dynamically or tagged template in PreferenceRepository.update
        // PreferenceRepository uses dynamic keys for update
        const queryLower = queryStr.toLowerCase()
        if (queryLower.includes('onboarding_step')) {
          // Find value passed for onboarding_step
          const stepIndex = strings.findIndex(s => s.includes('onboarding_step'))
          if (stepIndex !== -1 && values[stepIndex] !== undefined) {
            store.preferences.onboarding_step = values[stepIndex]
          }
        }
        if (queryLower.includes('has_completed_onboarding')) {
          const compIndex = strings.findIndex(s => s.includes('has_completed_onboarding'))
          if (compIndex !== -1 && values[compIndex] !== undefined) {
            store.preferences.has_completed_onboarding = values[compIndex]
          }
        }
        return [store.preferences]
      }
      if (queryStr.includes('FROM sender_cache')) {
        return store.senders
      }
      if (queryStr.includes('FROM protected_senders')) {
        return []
      }
      return []
    }
    setDbForTesting(mockSql)
  })

  afterEach(() => {
    resetDbForTesting()
  })

  it('getOnboardingState returns correct initial step and clean state evaluation', async () => {
    const state = await onboardingService.getOnboardingState(TEST_USER)
    assert.equal(state.userId, TEST_USER)
    assert.equal(state.onboardingStep, 'welcome')
    assert.equal(state.hasCompletedOnboarding, false)
    assert.deepEqual(state.protectedCategories, ['Banking', 'Finance', 'Bills'])
    assert.equal(state.shouldStartAtDashboard, false)
  })

  it('triggerOnboardingCelebrationIfApplicable completes onboarding on first cleanup and returns celebration metrics', async () => {
    // Custom mock handling dynamic query built by PreferenceRepository.update
    const customMockSql = async (strings, ...values) => {
      const queryStr = strings.join('?')
      if (queryStr.includes('FROM preferences') && queryStr.includes('SELECT')) {
        return [store.preferences]
      }
      if (queryStr.includes('UPDATE preferences') || queryStr.includes('INSERT INTO preferences')) {
        store.preferences.has_completed_onboarding = true
        store.preferences.onboarding_step = 'completed'
        return [store.preferences]
      }
      return []
    }
    setDbForTesting(customMockSql)

    const celebration = await onboardingService.triggerOnboardingCelebrationIfApplicable(TEST_USER, {
      emailsCleaned: 150,
      storageMB: 45.5
    })

    assert.ok(celebration !== null, 'Celebration payload returned')
    assert.equal(celebration.emailsCleaned, 150)
    assert.equal(celebration.storageMB, 45.5)
    assert.equal(celebration.timeSavedMinutes, Math.round((150 * 4) / 60))
    assert.ok(celebration.healthImprovement >= 5 && celebration.healthImprovement <= 25)
    assert.equal(store.preferences.has_completed_onboarding, true)
    assert.equal(store.preferences.onboarding_step, 'completed')
  })

  it('triggerOnboardingCelebrationIfApplicable returns null if onboarding is already completed', async () => {
    store.preferences.has_completed_onboarding = true
    store.preferences.onboarding_step = 'completed'

    const celebration = await onboardingService.triggerOnboardingCelebrationIfApplicable(TEST_USER, {
      emailsCleaned: 50,
      storageMB: 10
    })

    assert.equal(celebration, null)
  })
})
