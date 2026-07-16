import { suggestCategory } from '../categorizer.js'

/**
 * Insights Engine: Transforms normalized metrics and scores into 14+ explainable,
 * deterministic widgets where every item includes exact values, 'why' explanation,
 * and an actionable routing instruction.
 */
export const insightsEngine = {
  generateWidgets(normalized, scores) {
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
      largeAttachmentsBytes,
      newslettersBytes,
      largeMessagesBytes,
      categoryCounts,
      categoryMessages,
      categoryStorageBytes,
      recentCleanupSessionsCount,
      cleanupStreakDays,
      senders
    } = normalized

    const { healthScore, healthLevel, breakdown, secondary, cleanupPotential } = scores
    const safeEmails = Math.max(1, totalEmails)

    // 1. Mailbox Health Score Widget
    const weakestComponent = Object.entries(breakdown).sort((a, b) => a[1] - b[1])[0] || ['cleanliness', 100]
    const healthWidget = {
      id: 'health_score',
      score: healthScore,
      level: healthLevel,
      breakdown,
      secondary,
      why: `Your mailbox health is ${healthLevel} (${healthScore}/100). The biggest area for improvement is ${weakestComponent[0]} (${weakestComponent[1]}/100).`,
      action: { label: 'Improve Health', type: 'navigate', target: '/mailbox' }
    }

    // 2. Today's Priorities (Top 5 Opportunities)
    const priorities = []
    const now = Date.now()
    for (const s of senders) {
      if (!s || !s.email) continue
      const count = Number(s.messageCount || 0)
      const sizeMB = Number((Number(s.totalSizeEstimate || 0) / (1024 * 1024)).toFixed(1))
      const catInfo = suggestCategory(s)
      const cat = catInfo?.category || 'Other'

      // Skip protected or high-trust senders
      if (cat === 'Banking' || cat === 'Finance' || cat === 'Work' || (s.domain && s.domain.endsWith('.gov'))) continue

      const lastDate = s.lastMessageDate ? new Date(s.lastMessageDate).getTime() : 0
      const inactiveDays = lastDate ? Math.max(0, Math.floor((now - lastDate) / (24 * 3600 * 1000))) : 60
      const interactionWeight = Number(s.unreadCount || 0) > 0 ? 0 : 20

      // Impact formula: (Storage * 0.40) + (Count * 0.30) + (InactiveDays * 0.20) + (Interaction * 0.10)
      const impactScore = Math.round((sizeMB * 0.40) + (Math.min(100, count) * 0.30) + (Math.min(100, inactiveDays) * 0.20) + (interactionWeight * 0.10))

      if (count >= 5 || sizeMB >= 2) {
        priorities.push({
          id: `priority_${s.email}`,
          senderEmail: s.email,
          senderName: s.displayName || s.email.split('@')[0],
          category: cat,
          messageCount: count,
          storageMB: sizeMB,
          impactScore,
          why: `${s.displayName || s.email} accounts for ${sizeMB} MB across ${count} emails with ${inactiveDays} days of inactivity.`,
          action: { label: 'Clean Up Sender', type: 'filter_and_clean', target: s.email }
        })
      }
    }
    priorities.sort((a, b) => b.impactScore - a.impactScore)
    const topPriorities = priorities.slice(0, 5)

    // 3. Mailbox DNA Identity
    let identity = 'Balanced Communication'
    let dominantCategory = 'Other'
    let highestShare = 0
    for (const [cat, count] of Object.entries(categoryMessages)) {
      const share = count / safeEmails
      if (share > highestShare) {
        highestShare = share
        dominantCategory = cat
      }
    }
    const dominantPercentage = Math.round(highestShare * 100)
    if (dominantCategory === 'Promotions' || dominantCategory === 'Shopping') {
      identity = dominantPercentage > 35 ? 'Shopping Heavy' : identity
    } else if (dominantCategory === 'Banking' || dominantCategory === 'Finance' || dominantCategory === 'Bills') {
      identity = dominantPercentage > 25 ? 'Finance Focused' : identity
    } else if (dominantCategory === 'Newsletters') {
      identity = dominantPercentage > 35 ? 'Newsletters Heavy' : identity
    } else if (dominantCategory === 'Work') {
      identity = dominantPercentage > 30 ? 'Work & Professional' : identity
    } else if (dominantCategory === 'Social') {
      identity = dominantPercentage > 30 ? 'Social & Forums' : identity
    }

    const dnaWidget = {
      id: 'mailbox_dna',
      identity,
      dominantCategory,
      dominantPercentage,
      distribution: categoryMessages,
      why: `Your primary inbox footprint is ${dominantCategory}, representing ${dominantPercentage}% of your total volume.`,
      action: { label: `Manage ${dominantCategory}`, type: 'filter_category', target: dominantCategory }
    }

    // 4. Promotional Alert Card
    const promotionsMB = Number(((categoryStorageBytes.Promotions || 0) / (1024 * 1024)).toFixed(1))
    const promotionsCount = categoryMessages.Promotions || 0
    const isPromotionsTriggered = promotionsMB > 500 || promotionsCount > 100
    const promotionsWidget = {
      id: 'promotions_alert',
      isTriggered: isPromotionsTriggered,
      messageCount: promotionsCount,
      storageMB: promotionsMB,
      why: `You have ${promotionsCount} promotional emails occupying ${promotionsMB} MB of storage quota.`,
      action: { label: 'Bulk Trash Promotions', type: 'filter_category', target: 'Promotions' }
    }

    // 5. Storage Recovery Breakdown & Attachments Widget
    const largeAttachmentsMB = Number((largeAttachmentsBytes / (1024 * 1024)).toFixed(1))
    const newslettersMB = Number((newslettersBytes / (1024 * 1024)).toFixed(1))
    const largeMessagesMB = Number((largeMessagesBytes / (1024 * 1024)).toFixed(1))
    const storageWidget = {
      id: 'storage_recovery',
      totalRecoveryMB: candidateStorageMB,
      breakdown: {
        largeAttachmentsMB,
        newslettersMB,
        largeMessagesMB,
        promotionsMB
      },
      why: `You can instantly reclaim ${candidateStorageMB} MB by clearing attachments (${largeAttachmentsMB} MB) and outdated newsletters (${newslettersMB} MB).`,
      action: { label: 'Review Large Attachments', type: 'filter_size', target: '>5MB' }
    }

    // 6. Estimated Cleanup Time & Time Saved Widget
    const estimatedMinutes = Math.max(1, Math.ceil(candidateEmails / 40))
    const potentialTimeSavedSeconds = candidateEmails * 4
    const potentialTimeSavedMinutes = Math.round(potentialTimeSavedSeconds / 60)
    const potentialTimeSavedHours = Number((potentialTimeSavedMinutes / 60).toFixed(1))
    const potentialWorkDays = Number((potentialTimeSavedHours / 8).toFixed(1))
    const timeSavedWidget = {
      id: 'time_saved',
      estimatedMinutes,
      potentialTimeSavedMinutes,
      potentialTimeSavedHours,
      potentialWorkDays,
      why: `Automating the deletion of ${candidateEmails} emails saves approximately ${potentialTimeSavedHours} hours (${potentialWorkDays} work days) of manual clearing.`,
      action: { label: 'Start 1-Click Cleanup', type: 'navigate', target: '/cleanup' }
    }

    // 7. Weekly Progress & Cleanup Streak
    const streakWidget = {
      id: 'cleanup_streak',
      streakDays: cleanupStreakDays,
      recentSessionsCount: recentCleanupSessionsCount,
      why: cleanupStreakDays > 0 ? `Awesome! You are on a ${cleanupStreakDays}-day cleanup streak.` : `Start your daily cleanup streak today to keep clutter permanently away.`,
      action: { label: cleanupStreakDays > 0 ? 'Continue Streak' : 'Start Streak', type: 'navigate', target: '/mailbox' }
    }

    // 8. 30-Day Forecast
    const predictedGrowthMessages = Math.round(promotionsAndMarketing * 0.6)
    const predictedGrowthMB = Math.round(promotionsMB * 0.6)
    const forecastWidget = {
      id: 'thirty_day_forecast',
      predictedGrowthMessages,
      predictedGrowthMB,
      why: `Without cleanup, your inbox is projected to accumulate ~${predictedGrowthMessages} new clutter emails (${predictedGrowthMB} MB) over the next 30 days.`,
      action: { label: 'Set Up Auto-Rules', type: 'navigate', target: '/rules' }
    }

    // 9. Achievement Badges System (7 Badges)
    const achievements = [
      {
        id: 'first_cleanup',
        title: 'First Cleanup',
        description: 'Complete your first mailbox cleaning action.',
        progress: recentCleanupSessionsCount > 0 ? 1 : 0,
        maxProgress: 1,
        isUnlocked: recentCleanupSessionsCount > 0
      },
      {
        id: 'one_k_club',
        title: '1K Club',
        description: 'Identify and target 1,000 cleanable messages.',
        progress: Math.min(1000, candidateEmails),
        maxProgress: 1000,
        isUnlocked: candidateEmails >= 1000
      },
      {
        id: 'storage_saver',
        title: 'Storage Saver',
        description: 'Discover 500 MB of reclaimable space.',
        progress: Math.min(500, Math.round(candidateStorageMB)),
        maxProgress: 500,
        isUnlocked: candidateStorageMB >= 500
      },
      {
        id: 'newsletter_ninja',
        title: 'Newsletter Ninja',
        description: 'Track at least 10 active newsletters.',
        progress: Math.min(10, totalSubscriptionSenders),
        maxProgress: 10,
        isUnlocked: totalSubscriptionSenders >= 10
      },
      {
        id: 'inbox_hero',
        title: 'Inbox Hero',
        description: 'Reach an Excellent Mailbox Health score (90+).',
        progress: Math.min(90, healthScore),
        maxProgress: 90,
        isUnlocked: healthScore >= 90
      },
      {
        id: 'seven_day_streak',
        title: '7-Day Streak',
        description: 'Maintain a 7-day consecutive cleanup streak.',
        progress: Math.min(7, cleanupStreakDays),
        maxProgress: 7,
        isUnlocked: cleanupStreakDays >= 7
      },
      {
        id: 'label_master',
        title: 'Label Master',
        description: 'Have at least 5 senders organized into labels.',
        progress: Math.min(5, labeledSenders),
        maxProgress: 5,
        isUnlocked: labeledSenders >= 5
      }
    ]

    return {
      health: healthWidget,
      topPriorities,
      dna: dnaWidget,
      promotions: promotionsWidget,
      storage: storageWidget,
      timeSaved: timeSavedWidget,
      streak: streakWidget,
      forecast: forecastWidget,
      achievements,
      cleanupPotential
    }
  }
}
