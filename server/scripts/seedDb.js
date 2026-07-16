import { getDb } from '../src/db/db.js'
import { DEMO_USERS, MOCK_SENDERS_DEFINITION } from '../src/gmail/mockDataset.js'

/**
 * Comprehensive Database Seeder (`/grill-me` specification)
 * Pre-populates all 13 tables in the Unified 1:1 User/Account Architecture
 * with realistic mock data for UI sandbox and Fake Gmail API testing.
 */
export async function seedDemoAccount(sql = getDb()) {
  console.log('🌱 Seeding database with Personal Hub demo dataset across all 13 tables...')

  // 1. Seed users table (1:1 with Google account)
  for (const user of DEMO_USERS) {
    await sql`
      INSERT INTO users (id, email, display_name, avatar_url, last_login_at, created_at)
      VALUES (${user.id}, ${user.email}, ${user.display_name}, ${user.avatar_url}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = CURRENT_TIMESTAMP
    `
  }

  // 2. Seed mock tokens table
  for (const user of DEMO_USERS) {
    await sql`
      INSERT INTO tokens (user_id, encrypted, iv, updated_at)
      VALUES (${user.id}, 'demo_mock_encrypted_token_aes256gcm', 'demo_mock_iv_12b', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `
  }

  // 3. Seed per-user preferences
  for (const user of DEMO_USERS) {
    await sql`
      INSERT INTO preferences (user_id, default_time_range, scan_max_messages, label_prefix, digest_enabled, digest_day, digest_hour, digest_recipient, digest_senders)
      VALUES (${user.id}, '6m', NULL, 'Unsub/', 1, 1, 9, ${user.email}, '[]'::jsonb)
      ON CONFLICT(user_id) DO UPDATE SET
        default_time_range = EXCLUDED.default_time_range,
        label_prefix = EXCLUDED.label_prefix,
        digest_enabled = EXCLUDED.digest_enabled,
        digest_recipient = EXCLUDED.digest_recipient
    `
  }

  // 4. Seed protected senders per user
  const bankingDomains = ['chase.com', 'hdfcbank.net', 'irs.gov', 'paypal.com', 'stripe.com', 'wellsfargo.com', 'bankofamerica.com']
  for (const user of DEMO_USERS) {
    for (const domain of bankingDomains) {
      const email = `alerts@${domain}`
      await sql`
        INSERT INTO protected_senders (user_id, email, domain, source, added_at)
        VALUES (${user.id}, ${email}, ${domain}, 'auto', CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, email) DO NOTHING
      `
    }
  }

  // 5. Seed label registry for demo personal user
  const labels = [
    { name: 'Unsub/Newsletters', id: 'mock_lbl_newsletters' },
    { name: 'Unsub/Promotions', id: 'mock_lbl_promotions' }
  ]
  for (const lbl of labels) {
    await sql`
      INSERT INTO label_registry (user_id, label_name, gmail_id, created_at)
      VALUES (${DEMO_USERS[0].id}, ${lbl.name}, ${lbl.id}, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, label_name) DO UPDATE SET gmail_id = EXCLUDED.gmail_id
    `
  }

  // 6. Seed saved views
  const savedViews = [
    { name: 'High Volume Newsletters', query: 'label:newsletters' },
    { name: 'Large Storage Reclaim', query: 'larger:10M' }
  ]
  for (const view of savedViews) {
    await sql`
      INSERT INTO saved_views (user_id, name, filter_json, sort_json, created_at)
      VALUES (${DEMO_USERS[0].id}, ${view.name}, ${JSON.stringify({ query: view.query })}, '{}'::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, name) DO UPDATE SET filter_json = EXCLUDED.filter_json
    `
  }

  // 7. Seed 90 days of rich historical activity records for Command Center / DNA Chart
  const actions = [
    { action: 'login', details: { email: 'demo.personal@gmail.com' } },
    { action: 'scan', details: { sendersFound: 80, messagesTotal: 1540 } },
    { action: 'unsubscribe', details: { email: 'promotions@target.com', method: 'https' } },
    { action: 'trash', details: { count: 45, sender: 'store-news@amazon.com' } },
    { action: 'keep_latest', details: { keepCount: 3, trashedCount: 82, sender: 'daily@substack.com' } },
    { action: 'label', details: { labelName: 'Unsub/Newsletters', messagesLabeled: 250 } },
    { action: 'trash', details: { count: 30, sender: 'beauty@sephora.com' } },
    { action: 'unsubscribe', details: { email: 'deals@bestbuy.com', method: 'https' } }
  ]

  await sql`DELETE FROM activity_log WHERE user_id = ${DEMO_USERS[0].id}`
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  for (let i = 0; i < 35; i++) {
    const actionObj = actions[i % actions.length]
    const daysAgo = Math.floor((i / 35) * 88)
    const timestamp = new Date(now - daysAgo * DAY_MS)
    await sql`
      INSERT INTO activity_log (user_id, action, details, created_at)
      VALUES (${DEMO_USERS[0].id}, ${actionObj.action}, ${JSON.stringify(actionObj.details)}, ${timestamp.toISOString()})
    `
  }

  // 8. Seed weekly digest baseline
  const knownSenders = MOCK_SENDERS_DEFINITION.map(s => s.email)
  await sql`
    INSERT INTO digest_baseline (user_id, senders, last_run_at, updated_at)
    VALUES (${DEMO_USERS[0].id}, ${JSON.stringify(knownSenders)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET senders = EXCLUDED.senders, updated_at = CURRENT_TIMESTAMP
  `

  // 9. Seed scan_cache summary
  const totalStorage = MOCK_SENDERS_DEFINITION.reduce((acc, s) => acc + (s.count * (s.avgSize || 45000)), 0) / (1024 * 1024)
  const recoverableStorage = totalStorage * 0.45
  await sql`
    INSERT INTO scan_cache (
      user_id, last_scan, total_messages, total_senders, unread_messages,
      storage_used_mb, recoverable_storage_mb, health_score, cleanup_score,
      organization_score, security_score, newsletter_count, large_attachment_count,
      mailbox_dna, dashboard_json, updated_at
    )
    VALUES (
      ${DEMO_USERS[0].id}, CURRENT_TIMESTAMP, 1540, 80, 310,
      ${totalStorage.toFixed(2)}, ${recoverableStorage.toFixed(2)}, 84, 82,
      88, 96, 20, 5,
      ${JSON.stringify({ primaryCategory: 'Newsletters', topDomain: 'substack.com' })},
      ${JSON.stringify({ status: 'ready', lastScan: new Date().toISOString() })},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(user_id) DO UPDATE SET
      total_messages = EXCLUDED.total_messages,
      total_senders = EXCLUDED.total_senders,
      storage_used_mb = EXCLUDED.storage_used_mb,
      recoverable_storage_mb = EXCLUDED.recoverable_storage_mb,
      updated_at = CURRENT_TIMESTAMP
  `

  // 10. Seed sender_cache with all 80 mock senders
  await sql`DELETE FROM sender_cache WHERE user_id = ${DEMO_USERS[0].id}`
  for (const sender of MOCK_SENDERS_DEFINITION) {
    const totalMsg = sender.count || 20
    const unreadMsg = Math.floor(totalMsg * 0.2)
    const storageMb = ((sender.avgSize || 45000) * totalMsg) / (1024 * 1024)
    const isProtected = Boolean(sender.protectedReason)
    await sql`
      INSERT INTO sender_cache (
        user_id, sender_email, sender_name, domain, category,
        total_messages, unread_messages, storage_mb,
        first_received, last_received, open_rate, health_score,
        recommendation, verified, protected, updated_at
      )
      VALUES (
        ${DEMO_USERS[0].id}, ${sender.email}, ${sender.name}, ${sender.domain}, ${sender.category || 'Other'},
        ${totalMsg}, ${unreadMsg}, ${storageMb.toFixed(2)},
        CURRENT_TIMESTAMP - INTERVAL '180 days', CURRENT_TIMESTAMP, 35, 85,
        ${isProtected ? 'Keep' : 'Unsubscribe'}, true, ${isProtected}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(user_id, sender_email) DO UPDATE SET
        total_messages = EXCLUDED.total_messages,
        storage_mb = EXCLUDED.storage_mb,
        updated_at = CURRENT_TIMESTAMP
    `
  }

  // 11. Seed cleanup_history sample
  await sql`
    INSERT INTO cleanup_history (user_id, emails_removed, storage_saved_mb, time_saved_seconds, duration_seconds, created_at)
    VALUES (${DEMO_USERS[0].id}, 245, 120.50, 1800, 14, CURRENT_TIMESTAMP - INTERVAL '2 days')
  `

  // 12. Seed weekly_digest sample
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  await sql`
    INSERT INTO weekly_digest (user_id, week_start, summary, generated_at)
    VALUES (${DEMO_USERS[0].id}, ${weekStartStr}, ${JSON.stringify({ newSubscriptions: 3, cleanedCount: 45, storageFreedMb: 18.4 })}, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, week_start) DO UPDATE SET summary = EXCLUDED.summary
  `

  // 13. Seed scan_metadata timing diagnosis
  await sql`
    INSERT INTO scan_metadata (user_id, started_at, completed_at, emails_scanned, senders_found, duration_ms, status, error_message)
    VALUES (${DEMO_USERS[0].id}, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '59 minutes', 1540, 80, 1420, 'completed', null)
  `

  console.log('✅ Demo database seeded successfully with 2 users, 80 senders across all 13 tables!')
}

if (process.argv[1] && process.argv[1].endsWith('seedDb.js')) {
  seedDemoAccount()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Failed to seed database:', err)
      process.exit(1)
    })
}
