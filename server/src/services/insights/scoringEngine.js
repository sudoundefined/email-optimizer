/**
 * Scoring Engine: Evaluates exact, deterministic mathematical scores across Mailbox Health,
 * Organization, Security, and Cleanup Potential. No AI or non-deterministic estimations allowed.
 */
export const scoringEngine = {
  calculateScores(normalized, maxStorageThresholdMB = 15000) {
    const {
      totalEmails,
      totalStorageMB,
      unreadCount,
      senderCount,
      protectedSendersCount,
      importantSendersCount,
      promotionsAndMarketing,
      totalSubscriptionSenders,
      inactiveSubscriptionSenders,
      labeledSenders,
      candidateEmails,
      candidateStorageMB,
      recentCleanupSessionsCount,
      cleanupStreakDays
    } = normalized

    const safeEmails = Math.max(1, totalEmails)
    const safeSenders = Math.max(1, senderCount)
    const safeImportant = Math.max(1, importantSendersCount)
    const safeSubs = Math.max(1, totalSubscriptionSenders)

    // 1. Cleanliness Component (20%) — Low percentage of promotional and marketing clutter
    const cleanlinessScore = Math.max(0, Math.min(100, 100 - (promotionsAndMarketing / safeEmails * 100)))

    // 2. Readability Component (15%) — Low unread ratio
    const readabilityScore = Math.max(0, Math.min(100, 100 - (unreadCount / safeEmails * 100)))

    // 3. Organization Component (15%) — Labeled senders ratio plus inbox orderliness
    const cleanRatio = Math.max(0, Math.min(1, (safeEmails - candidateEmails) / safeEmails))
    const organizationScore = Math.max(0, Math.min(100, ((labeledSenders / safeSenders) * 60) + (cleanRatio * 40)))

    // 4. Storage Efficiency Component (15%) — Quota headroom against threshold (15GB default)
    const storageEfficiencyScore = Math.max(0, Math.min(100, 100 - (totalStorageMB / maxStorageThresholdMB * 100)))

    // 5. Sender Trust Component (10%) — Proportion of important senders explicitly protected
    const senderTrustScore = Math.max(0, Math.min(100, (protectedSendersCount / safeImportant) * 100))

    // 6. Subscription Hygiene Component (15%) — Low ratio of inactive/ghost subscriptions
    const subscriptionHygieneScore = Math.max(0, Math.min(100, 100 - (inactiveSubscriptionSenders / safeSubs * 100)))

    // 7. Cleanup Activity Component (10%) — Recent cleanup sessions and active streaks
    const cleanupActivityScore = Math.max(0, Math.min(100, (recentCleanupSessionsCount * 25) + (cleanupStreakDays * 15)))

    // Total Mailbox Health Score (Weighted Sum)
    const rawHealth = (
      cleanlinessScore * 0.20 +
      readabilityScore * 0.15 +
      organizationScore * 0.15 +
      storageEfficiencyScore * 0.15 +
      senderTrustScore * 0.10 +
      subscriptionHygieneScore * 0.15 +
      cleanupActivityScore * 0.10
    )
    const healthScore = Math.round(Math.max(0, Math.min(100, rawHealth)))

    let healthLevel = 'Needs Attention'
    if (healthScore >= 90) healthLevel = 'Excellent'
    else if (healthScore >= 75) healthLevel = 'Good'
    else if (healthScore >= 60) healthLevel = 'Fair'

    // Secondary Sub-Scores
    const securityScore = Math.round((senderTrustScore * 0.60) + (readabilityScore * 0.40))
    const priorityScore = Math.round(Math.max(0, Math.min(100, (candidateStorageMB / Math.max(1, totalStorageMB) * 60) + (candidateEmails / safeEmails * 40))))

    return {
      healthScore,
      healthLevel,
      breakdown: {
        cleanliness: Math.round(cleanlinessScore),
        readability: Math.round(readabilityScore),
        organization: Math.round(organizationScore),
        storageEfficiency: Math.round(storageEfficiencyScore),
        senderTrust: Math.round(senderTrustScore),
        subscriptionHygiene: Math.round(subscriptionHygieneScore),
        cleanupActivity: Math.round(cleanupActivityScore)
      },
      secondary: {
        organizationScore: Math.round(organizationScore),
        securityScore,
        priorityScore
      },
      cleanupPotential: {
        messages: candidateEmails,
        storageMB: candidateStorageMB,
        storageGB: Number((candidateStorageMB / 1024).toFixed(1)),
        percentageOfTotal: Math.round((candidateEmails / safeEmails) * 100)
      }
    }
  }
}
