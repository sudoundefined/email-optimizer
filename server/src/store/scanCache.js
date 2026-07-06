let cache = null

/** cache shape: {scannedAt, range, messageCount, senders: Map<email, Sender>} */
export function setScan(result) {
  cache = result
}

export function getScan() {
  return cache
}

export function requireScan() {
  if (!cache) {
    const err = new Error('No scan available — run a scan first.')
    err.status = 409
    throw err
  }
  return cache
}
