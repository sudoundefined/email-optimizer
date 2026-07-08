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
  state: 'running' | 'done' | 'error'
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

export interface StorageStats {
  totalMB: number
  messageCount: number
  senders: StorageSender[]
  months: StorageMonth[]
  attachments: StorageAttachment[]
}

export const CATEGORIES = [
  'Promotions',
  'Newsletters',
  'Social',
  'Shopping',
  'Finance',
  'Travel',
  'Other',
]
