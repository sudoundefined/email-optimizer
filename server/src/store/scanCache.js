/** Per-user in-memory scan cache. */
const caches = new Map()

/** cache shape: {scannedAt, range, messageCount, senders: Map<email, Sender>} */
export function setScan(userId, result) {
  caches.set(userId, result)
}

export function getScan(userId) {
  return caches.get(userId) || null
}

export function requireScan(userId) {
  const cache = caches.get(userId)
  if (!cache) {
    const err = new Error('No scan available — run a scan first.')
    err.status = 409
    throw err
  }
  return cache
}

export function clearScan(userId) {
  caches.delete(userId)
}
