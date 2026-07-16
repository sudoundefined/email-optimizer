export type UnsubMethod = 'oneclick' | 'mailto' | 'link' | 'none'

export interface Sender {
  email: string
  name: string
  domain: string
  messageCount: number
  latestSubject: string
  latestDate: number
  method: UnsubMethod
}

export interface Subscription {
  vendor: string
  email: string
  name: string
  domain: string
  messageCount: number
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'unknown'
  lastSeen: number
  method: UnsubMethod
}

export interface ScanResult {
  scannedAt: string
  range: string
  messageCount: number
  senders: Sender[]
}

export interface OnboardingState {
  userId: string
  onboardingStep: 'welcome' | 'privacy' | 'config' | 'scanning' | 'story' | 'celebration' | 'completed'
  hasCompletedOnboarding: boolean
  protectedCategories: string[]
  isClean: boolean
  shouldStartAtDashboard: boolean
}

export interface CelebrationPayload {
  emailsCleaned: number
  storageMB: number
  timeSavedMinutes: number
  healthImprovement: number
}

export interface AuthStatus {
  connected: boolean
  email?: string
  user?: {
    id: string
    email: string
    displayName?: string
    avatarUrl?: string
    onboarding?: OnboardingState
    preferences?: Record<string, unknown>
  }
}

export interface JobSnapshot {
  id: string
  name: string
  state: 'running' | 'done' | 'error' | 'cancelled'
  progress: Record<string, unknown> | null
  result: unknown
  error: string | null
}

export interface UnsubResult {
  sender: string
  method: UnsubMethod
  status: 'success' | 'manual' | 'failed'
  detail: string
  manualUrl?: string
}

export interface UnsubSummary {
  total: number
  success: number
  manual: number
  failed: number
  results: UnsubResult[]
  celebration?: CelebrationPayload | null
}

export interface Suggestion {
  senderEmail: string
  messageCount: number
  category: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export interface AppLabel {
  id: string
  name: string
  messagesTotal: number
  messagesUnread: number
}

export interface InboxGroup {
  key: string
  title: string
  blurb: string
  count: number
  unread: number | null
  approx: boolean
}

export interface GroupMessage {
  id: string
  from: string
  subject: string
  date: number
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messagesTotal: number
  messagesUnread: number
  appCreated: boolean
}

export interface ProtectedSender {
  email: string
  reason: 'auto:domain' | 'auto:subject' | 'manual'
  addedAt: string
}

export interface Filter {
  key: string
  label: string
  query: string
  category: 'engagement' | 'cleanup' | 'category'
}

export interface StorageSender {
  email: string
  name: string
  totalMB: number
  messageCount: number
}

export interface StorageMonth {
  month: string
  totalMB: number
  messageCount: number
}

export interface StorageAttachment {
  id: string
  from: string
  subject: string
  sizeMB: number
  date: number
}

export interface StorageDrillMessage {
  id: string
  from: string
  subject: string
  sizeMB: number
  date: number
  hasAttachment: boolean
}

export interface StorageYear {
  year: string
  totalMB: number
  messageCount: number
}

export interface StorageSizeBand {
  key: string
  label: string
  totalMB: number
  messageCount: number
}

export interface StorageStats {
  totalMB: number
  messageCount: number
  senders: StorageSender[]
  months: StorageMonth[]
  years: StorageYear[]
  sizes: StorageSizeBand[]
  attachments: StorageAttachment[]
}

export const CATEGORIES = [
  'Work',
  'Banking',
  'Shopping',
  'Travel',
  'Medical',
  'Tax',
  'Bills',
  'Subscriptions',
  'Newsletters',
  'Social',
  'Promotions',
  'Education',
  'Entertainment',
  'Food & Dining',
  'Real Estate',
  'Health & Fitness',
  'Investing',
  'Personal',
  'Other',
]

export interface DigestSettings {
  enabled: boolean
  dayOfWeek: number // 0-6, Sunday=0
  hour: number // 0-23
  recipient: string // '' means the connected account's own address
}

export interface DigestRunHistory {
  at: string
  newSenders: number
  sent: boolean
  recipient: string | null
  error: string | null
}

export interface DigestState {
  settings: DigestSettings
  lastRunAt: string | null
  knownSenderCount: number
  history: DigestRunHistory[]
  running: boolean
}

export interface DigestNewSender {
  email: string
  name: string
  messageCount: number
  method: UnsubMethod
  unsubUrl: string | null
}

export interface DigestRunResult {
  dryRun: boolean
  seeding: boolean
  newSenders: DigestNewSender[]
  recipient: string
  totalScanned: number
  sent: boolean
}

export interface MailboxStoryResponse {
  totalEmails: number
  totalStorageBytes: number
  totalStorageMB: number
  totalStorageGB: number
  subscriptionSendersCount: number
  promotionsAndMarketingCount: number
  promotionsStorageMB: number
  promotionsStorageGB: number
  topSenders: {
    email: string
    name: string
    domain: string
    messageCount: number
    sizeEstimate: number
  }[]
  dominantCategory: {
    name: string
    percentage: number
    senderCount: number
  }
  cleanupPotential: {
    messages: number
    storageMB: number
    storageGB: number
  }
  estimatedMinutes: number
  isClean: boolean
}

export interface DashboardScores {
  healthScore: number
  healthLevel: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention'
  breakdown: {
    cleanliness: number
    readability: number
    organization: number
    storageEfficiency: number
    senderTrust: number
    subscriptionHygiene: number
    cleanupActivity: number
  }
  secondary: {
    organizationScore: number
    securityScore: number
    priorityScore: number
  }
  cleanupPotential: {
    messages: number
    storageMB: number
    storageGB: number
    percentageOfTotal: number
  }
}

export interface DashboardAction {
  label: string
  type: 'navigate' | 'filter_and_clean' | 'filter_category' | 'filter_size'
  target: string
}

export interface PriorityOpportunity {
  id: string
  senderEmail: string
  senderName: string
  category: string
  messageCount: number
  storageMB: number
  impactScore: number
  why: string
  action: DashboardAction
}

export interface AchievementBadge {
  id: string
  title: string
  description: string
  progress: number
  maxProgress: number
  isUnlocked: boolean
}

export interface DashboardWidgets {
  health: {
    id: string
    score: number
    level: string
    breakdown: Record<string, number>
    why: string
    action: DashboardAction
  }
  topPriorities: PriorityOpportunity[]
  dna: {
    id: string
    identity: string
    dominantCategory: string
    dominantPercentage: number
    distribution: Record<string, number>
    why: string
    action: DashboardAction
  }
  promotions: {
    id: string
    isTriggered: boolean
    messageCount: number
    storageMB: number
    why: string
    action: DashboardAction
  }
  storage: {
    id: string
    totalRecoveryMB: number
    breakdown: Record<string, number>
    why: string
    action: DashboardAction
  }
  timeSaved: {
    id: string
    estimatedMinutes: number
    potentialTimeSavedMinutes: number
    potentialTimeSavedHours: number
    potentialWorkDays: number
    why: string
    action: DashboardAction
  }
  streak: {
    id: string
    streakDays: number
    recentSessionsCount: number
    why: string
    action: DashboardAction
  }
  forecast: {
    id: string
    predictedGrowthMessages: number
    predictedGrowthMB: number
    why: string
    action: DashboardAction
  }
  achievements: AchievementBadge[]
  cleanupPotential: DashboardScores['cleanupPotential']
}

export interface DashboardInsightsResponse {
  scores: DashboardScores
  widgets: DashboardWidgets
  cachedAt?: number
}

export interface TrashSendersResult {
  trashed: number
  senders: number
  celebration?: CelebrationPayload | null
}

export interface TrashMessagesResult {
  trashed: number
  celebration?: CelebrationPayload | null
}
