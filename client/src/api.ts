import type {
  AuthStatus,
  ScanResult,
  Suggestion,
  AppLabel,
  JobSnapshot,
  InboxGroup,
  GroupMessage,
  GmailLabel,
  ProtectedSender,
  StorageStats,
} from './types'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (!res.ok) {
    let code = 'error'
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      code = body.error || code
      message = body.message || body.error || message
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message)
  }
  return res.json() as Promise<T>
}

export const api = {
  authStatus: () => request<AuthStatus>('/api/auth/status'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  startScan: (range: string) =>
    request<{ jobId: string }>('/api/scan', { method: 'POST', body: JSON.stringify({ range }) }),
  senders: () => request<ScanResult>('/api/senders'),
  startUnsubscribe: (senderEmails: string[]) =>
    request<{ jobId: string | null; excluded: number }>('/api/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ senderEmails }),
    }),
  trashSenders: (senderEmails: string[]) =>
    request<{ jobId: string | null; excluded: number }>('/api/senders/trash', {
      method: 'POST',
      body: JSON.stringify({ senderEmails }),
    }),
  suggestions: () => request<Suggestion[]>('/api/labels/suggestions'),
  applyLabels: (assignments: { senderEmail: string; labelName: string }[]) =>
    request<{ jobId: string }>('/api/labels/apply', {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    }),
  labels: () => request<AppLabel[]>('/api/labels'),
  deleteLabelOnly: (id: string) =>
    request<{ ok: boolean }>(`/api/labels/${id}?mode=labelOnly`, { method: 'DELETE' }),
  trashLabel: (id: string) =>
    request<{ jobId: string }>(`/api/labels/${id}?mode=trashEmails`, { method: 'DELETE' }),
  job: (id: string) => request<JobSnapshot>(`/api/jobs/${id}`),
  inboxGroups: () => request<InboxGroup[]>('/api/inbox/groups'),
  groupMessages: (key: string) => request<GroupMessage[]>(`/api/inbox/groups/${key}/messages`),
  allLabels: () => request<GmailLabel[]>('/api/inbox/labels'),
  filterMessages: (q: string) => request<GroupMessage[]>(`/api/inbox/filter?q=${encodeURIComponent(q)}`),
  protectedList: () => request<{ protected: ProtectedSender[] }>('/api/protect'),
  protectSenders: (emails: string[]) =>
    request<{ ok: boolean }>('/api/protect', { method: 'POST', body: JSON.stringify({ emails }) }),
  unprotectSenders: (emails: string[]) =>
    request<{ ok: boolean }>('/api/protect', { method: 'DELETE', body: JSON.stringify({ emails }) }),
  storageStats: () => request<StorageStats>('/api/storage/stats'),
  storageRefresh: () => request<{ ok: boolean }>('/api/storage/refresh', { method: 'POST' }),
}
