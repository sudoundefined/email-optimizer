/**
 * Serializes scan summary and sender items for the /api/scan endpoint response.
 */
export function serializeScanResult(scanResult) {
  if (!scanResult) return null

  const senders = (scanResult.senders || []).map(sender => ({
    email: sender.email || '',
    domain: sender.domain || '',
    name: sender.name || sender.displayName || sender.email || '',
    messageCount: sender.messageCount || sender.count || 0,
    firstSeen: sender.firstSeen || null,
    lastSeen: sender.lastSeen || null,
    hasUnsubscribe: Boolean(sender.hasUnsubscribe || sender.listUnsubscribe),
    listUnsubscribe: sender.listUnsubscribe || null,
    listUnsubscribePost: sender.listUnsubscribePost || null,
    isProtected: Boolean(sender.isProtected),
    category: sender.category || 'general'
  }))

  return {
    summary: {
      totalMessagesScanned: scanResult.summary?.totalMessagesScanned ?? scanResult.totalScanned ?? 0,
      uniqueSendersCount: senders.length,
      unsubscribableSendersCount: senders.filter(s => s.hasUnsubscribe).length,
      protectedSendersCount: senders.filter(s => s.isProtected).length,
      scannedAt: new Date().toISOString()
    },
    senders
  }
}
