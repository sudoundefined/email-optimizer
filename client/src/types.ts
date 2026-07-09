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

export interface ScanResult {
  scannedAt: string
  range: string
  messageCount: number
  senders: Sender[]
}

export interface AuthStatus {
  connected: boolean
  email?: string
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
