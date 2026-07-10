import type { StorageStats, GmailLabel } from './types'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

function getLocal<T>(key: string): CacheEntry<T> | null {
  try {
    const val = localStorage.getItem(key)
    if (!val) return null
    const parsed = JSON.parse(val) as CacheEntry<T>
    if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function setLocal<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // ignore quota or disabled storage errors
  }
}

let storageInMemory: CacheEntry<StorageStats> | null = null
let labelsInMemory: CacheEntry<GmailLabel[]> | null = null

export const clientCache = {
  getStorageStats: () => {
    if (storageInMemory && Date.now() - storageInMemory.timestamp <= CACHE_EXPIRY_MS) {
      return storageInMemory
    }
    const local = getLocal<StorageStats>('optimizer_storage_cache')
    if (local) {
      storageInMemory = local
      return local
    }
    return null
  },
  setStorageStats: (data: StorageStats) => {
    storageInMemory = { data, timestamp: Date.now() }
    setLocal('optimizer_storage_cache', data)
  },
  clearStorageStats: () => {
    storageInMemory = null
    localStorage.removeItem('optimizer_storage_cache')
  },

  getLabels: () => {
    if (labelsInMemory && Date.now() - labelsInMemory.timestamp <= CACHE_EXPIRY_MS) {
      return labelsInMemory
    }
    const local = getLocal<GmailLabel[]>('optimizer_labels_cache')
    if (local) {
      labelsInMemory = local
      return local
    }
    return null
  },
  setLabels: (data: GmailLabel[]) => {
    labelsInMemory = { data, timestamp: Date.now() }
    setLocal('optimizer_labels_cache', data)
  },
  clearLabels: () => {
    labelsInMemory = null
    localStorage.removeItem('optimizer_labels_cache')
  }
}
