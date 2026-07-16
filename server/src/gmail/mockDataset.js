/**
 * Full Spectrum Mock Dataset for EmailDiet (`/grill-me` specification)
 * Contains 2 demo users, 80 realistic senders across 4 categories,
 * and 1,500+ generated metadata message headers.
 */

export const DEMO_USERS = [
  {
    id: 'acc_demo_personal',
    email: 'demo.personal@gmail.com',
    display_name: 'Deepak (Personal Demo)',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  },
  {
    id: 'acc_demo_work',
    email: 'demo.work@gmail.com',
    display_name: 'Deepak (Work Demo)',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
  }
]

export const DEMO_ACCOUNTS = DEMO_USERS

export const MOCK_SENDERS_DEFINITION = [
  // 1. Newsletters & Creators (1-click HTTPS & mailto)
  { email: 'daily@substack.com', name: 'Substack Daily', domain: 'substack.com', category: 'Newsletters', count: 85, avgSize: 45000, unsubType: 'https' },
  { email: 'creators@morningbrew.com', name: 'Morning Brew', domain: 'morningbrew.com', category: 'Newsletters', count: 72, avgSize: 62000, unsubType: 'https' },
  { email: 'news@techcrunch.com', name: 'TechCrunch News', domain: 'techcrunch.com', category: 'Newsletters', count: 64, avgSize: 58000, unsubType: 'https' },
  { email: 'packy@notboring.co', name: 'Not Boring by Packy', domain: 'notboring.co', category: 'Newsletters', count: 42, avgSize: 38000, unsubType: 'https' },
  { email: 'ben@stratechery.com', name: 'Stratechery Update', domain: 'stratechery.com', category: 'Newsletters', count: 50, avgSize: 41000, unsubType: 'https' },
  { email: 'digest@hackernewsletter.com', name: 'Hacker Newsletter', domain: 'hackernewsletter.com', category: 'Newsletters', count: 68, avgSize: 51000, unsubType: 'https' },
  { email: 'hi@tldr.tech', name: 'TLDR Tech Daily', domain: 'tldr.tech', category: 'Newsletters', count: 90, avgSize: 49000, unsubType: 'https' },
  { email: 'team@thehustle.co', name: 'The Hustle Daily', domain: 'thehustle.co', category: 'Newsletters', count: 60, avgSize: 55000, unsubType: 'https' },
  { email: 'news@milkroad.com', name: 'Milk Road Crypto', domain: 'milkroad.com', category: 'Newsletters', count: 48, avgSize: 44000, unsubType: 'https' },
  { email: 'ed@bytebytego.com', name: 'ByteByteGo Architecture', domain: 'bytebytego.com', category: 'Newsletters', count: 36, avgSize: 47000, unsubType: 'https' },
  { email: 'dan@pragmaticengineer.com', name: 'The Pragmatic Engineer', domain: 'pragmaticengineer.com', category: 'Newsletters', count: 40, avgSize: 52000, unsubType: 'https' },
  { email: 'newsletter@smashingmagazine.com', name: 'Smashing Magazine', domain: 'smashingmagazine.com', category: 'Newsletters', count: 32, avgSize: 48000, unsubType: 'mailto' },
  { email: 'weekly@css-tricks.com', name: 'CSS-Tricks Weekly', domain: 'css-tricks.com', category: 'Newsletters', count: 28, avgSize: 43000, unsubType: 'mailto' },
  { email: 'digest@medium.com', name: 'Medium Daily Digest', domain: 'medium.com', category: 'Newsletters', count: 95, avgSize: 65000, unsubType: 'https' },
  { email: 'radar@oreilly.com', name: 'O\'Reilly Radar', domain: 'oreilly.com', category: 'Newsletters', count: 24, avgSize: 39000, unsubType: 'https' },
  { email: 'briefing@theverge.com', name: 'The Verge Briefing', domain: 'theverge.com', category: 'Newsletters', count: 55, avgSize: 53000, unsubType: 'https' },
  { email: 'wire@wired.com', name: 'WIRED Daily Wire', domain: 'wired.com', category: 'Newsletters', count: 48, avgSize: 56000, unsubType: 'https' },
  { email: 'newsletter@arstechnica.com', name: 'Ars Technica Dispatch', domain: 'arstechnica.com', category: 'Newsletters', count: 52, avgSize: 50000, unsubType: 'https' },
  { email: 'insights@gartner.com', name: 'Gartner Tech Insights', domain: 'gartner.com', category: 'Newsletters', count: 22, avgSize: 42000, unsubType: 'mailto' },
  { email: 'trends@cbinsights.com', name: 'CB Insights Tech Trends', domain: 'cbinsights.com', category: 'Newsletters', count: 34, avgSize: 46000, unsubType: 'https' },

  // 2. Promotions & E-commerce
  { email: 'store-news@amazon.com', name: 'Amazon Store Offers', domain: 'amazon.com', category: 'Promotions', count: 110, avgSize: 75000, unsubType: 'https' },
  { email: 'offers@swiggy.in', name: 'Swiggy Food Deals', domain: 'swiggy.in', category: 'Promotions', count: 88, avgSize: 68000, unsubType: 'https' },
  { email: 'food@zomato.com', name: 'Zomato Recommendations', domain: 'zomato.com', category: 'Promotions', count: 92, avgSize: 71000, unsubType: 'https' },
  { email: 'justdoit@nike.com', name: 'Nike Member Exclusives', domain: 'nike.com', category: 'Promotions', count: 45, avgSize: 82000, unsubType: 'https' },
  { email: 'promotions@target.com', name: 'Target Weekly Ad', domain: 'target.com', category: 'Promotions', count: 60, avgSize: 79000, unsubType: 'https' },
  { email: 'beauty@sephora.com', name: 'Sephora Beauty Pass', domain: 'sephora.com', category: 'Promotions', count: 50, avgSize: 84000, unsubType: 'https' },
  { email: 'deals@bestbuy.com', name: 'Best Buy Tech Deals', domain: 'bestbuy.com', category: 'Promotions', count: 58, avgSize: 77000, unsubType: 'https' },
  { email: 'coupons@uber.com', name: 'Uber & UberEats Promos', domain: 'uber.com', category: 'Promotions', count: 65, avgSize: 64000, unsubType: 'https' },
  { email: 'discounts@myntra.com', name: 'Myntra Fashion Sale', domain: 'myntra.com', category: 'Promotions', count: 78, avgSize: 88000, unsubType: 'https' },
  { email: 'specials@dominos.com', name: 'Dominos Pizza Specials', domain: 'dominos.com', category: 'Promotions', count: 52, avgSize: 61000, unsubType: 'mailto' },
  { email: 'rewards@starbucks.com', name: 'Starbucks Rewards', domain: 'starbucks.com', category: 'Promotions', count: 44, avgSize: 63000, unsubType: 'https' },
  { email: 'insider@adidas.com', name: 'Adidas Creators Club', domain: 'adidas.com', category: 'Promotions', count: 38, avgSize: 81000, unsubType: 'https' },
  { email: 'offers@booking.com', name: 'Booking.com Travel Deals', domain: 'booking.com', category: 'Promotions', count: 46, avgSize: 76000, unsubType: 'https' },
  { email: 'sales@gap.com', name: 'GAP Factory Alerts', domain: 'gap.com', category: 'Promotions', count: 40, avgSize: 73000, unsubType: 'https' },
  { email: 'perks@lyft.com', name: 'Lyft Rider Perks', domain: 'lyft.com', category: 'Promotions', count: 35, avgSize: 58000, unsubType: 'https' },

  // 3. Protected Banking & Government (Auto-protected heuristics)
  { email: 'alerts@hdfcbank.net', name: 'HDFC Bank Alerts', domain: 'hdfcbank.net', category: 'Finance', count: 45, avgSize: 18000, unsubType: 'none', protectedReason: 'auto:domain' },
  { email: 'no-reply@alert.chase.com', name: 'Chase Security Alerts', domain: 'chase.com', category: 'Finance', count: 38, avgSize: 16000, unsubType: 'none', protectedReason: 'auto:domain' },
  { email: 'service@paypal.com', name: 'PayPal Transaction Notice', domain: 'paypal.com', category: 'Finance', count: 52, avgSize: 22000, unsubType: 'none', protectedReason: 'auto:domain' },
  { email: 'invoices@stripe.com', name: 'Stripe Billing Receipt', domain: 'stripe.com', category: 'Finance', count: 64, avgSize: 25000, unsubType: 'none', protectedReason: 'auto:domain' },
  { email: 'notice@irs.gov', name: 'IRS Electronic Filing Alert', domain: 'irs.gov', category: 'Government', count: 8, avgSize: 31000, unsubType: 'none', protectedReason: 'auto:domain' },
  { email: 'statements@wellsfargo.com', name: 'Wells Fargo E-Statement', domain: 'wellsfargo.com', category: 'Finance', count: 24, avgSize: 19000, unsubType: 'none', protectedReason: 'auto:domain' },
  { email: 'security@bankofamerica.com', name: 'Bank of America Notice', domain: 'bankofamerica.com', category: 'Finance', count: 30, avgSize: 17000, unsubType: 'none', protectedReason: 'auto:domain' },

  // 4. Large Attachments & Heavy Storage Items (For Storage Reclaimer test)
  { email: 'reports@analytics-firm.com', name: 'Global Analytics Partners', domain: 'analytics-firm.com', category: 'Storage', count: 6, avgSize: 24000000, unsubType: 'mailto', attachmentName: 'Annual_Financial_Statement_2025.pdf' },
  { email: 'exports@figma-cloud.io', name: 'Figma Cloud Workspace', domain: 'figma-cloud.io', category: 'Storage', count: 4, avgSize: 48000000, unsubType: 'none', attachmentName: 'Design_System_Figma_Export.zip' },
  { email: 'media@studio-pro.net', name: 'Studio Pro Media Render', domain: 'studio-pro.net', category: 'Storage', count: 3, avgSize: 85000000, unsubType: 'none', attachmentName: 'Project_Video_Draft_v4.mp4' },
  { email: 'backups@cloud-storage.com', name: 'Cloud Backup Service', domain: 'cloud-storage.com', category: 'Storage', count: 8, avgSize: 32000000, unsubType: 'mailto', attachmentName: 'Database_Backup_Q2.tar.gz' },
  { email: 'assets@creative-agency.com', name: 'Creative Agency Assets', domain: 'creative-agency.com', category: 'Storage', count: 5, avgSize: 18000000, unsubType: 'mailto', attachmentName: 'Brand_Assets_Pack_2026.zip' },

  // 5. Work & Social Notifications
  { email: 'notifications@linkedin.com', name: 'LinkedIn Network', domain: 'linkedin.com', category: 'Social', count: 80, avgSize: 35000, unsubType: 'https' },
  { email: 'notifications@github.com', name: 'GitHub Notifications', domain: 'github.com', category: 'Work', count: 120, avgSize: 28000, unsubType: 'https' },
  { email: 'update@atlassian.com', name: 'Jira & Confluence Updates', domain: 'atlassian.com', category: 'Work', count: 75, avgSize: 33000, unsubType: 'https' },
  { email: 'team@slack.com', name: 'Slack Digest & Summary', domain: 'slack.com', category: 'Work', count: 65, avgSize: 31000, unsubType: 'https' }
]

/**
 * Generates the full 1,500+ mock message pool with exact Gmail v1 format.
 */
export function generateMockMessages(userId = 'acc_demo_personal') {
  const messages = []
  let idCounter = 100000

  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000

  for (const sender of MOCK_SENDERS_DEFINITION) {
    const count = sender.count || 20
    for (let i = 0; i < count; i++) {
      const msgId = `mock_msg_${++idCounter}`
      // Distribute timestamps across the last 180 days
      const daysAgo = Math.floor((i / count) * 175) + Math.floor(Math.random() * 3)
      const internalDate = now - daysAgo * DAY_MS - Math.floor(Math.random() * 3600000)

      // Vary size around avgSize
      const sizeEstimate = Math.max(5000, Math.floor(sender.avgSize * (0.8 + Math.random() * 0.4)))

      let subject = `${sender.name} Update #${count - i}: Latest Insights & Highlights`
      if (sender.category === 'Promotions') {
        subject = `🔥 ${sender.name} Special Offer #${count - i} - Don't miss out!`
      } else if (sender.category === 'Finance') {
        subject = `Security Alert: Account Statement #${count - i} Ready for Review`
      } else if (sender.category === 'Storage') {
        subject = `File Delivery: ${sender.attachmentName} (Archived Report #${i + 1})`
      }

      const headers = {
        from: `"${sender.name}" <${sender.email}>`,
        subject,
        date: new Date(internalDate).toUTCString()
      }

      if (sender.unsubType === 'https') {
        headers['list-unsubscribe'] = `<https://unsub.${sender.domain}/u/${msgId}>, <mailto:unsub@${sender.domain}?subject=unsub_${msgId}>`
        headers['list-unsubscribe-post'] = 'List-Unsubscribe=One-Click'
      } else if (sender.unsubType === 'mailto') {
        headers['list-unsubscribe'] = `<mailto:unsub@${sender.domain}?subject=unsub_${msgId}>`
      }

      messages.push({
        id: msgId,
        threadId: `mock_thread_${Math.floor(idCounter / 3)}`,
        labelIds: ['INBOX'],
        sizeEstimate,
        internalDate,
        headers
      })
    }
  }

  // Sort newest first
  messages.sort((a, b) => b.internalDate - a.internalDate)
  return messages
}
