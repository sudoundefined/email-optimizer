import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { AuthStatus } from '../types'

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.authStatus())
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api.logout()
    setStatus({ connected: false })
  }, [])

  const markDisconnected = useCallback(() => setStatus({ connected: false }), [])

  return { status, loading, refresh, logout, markDisconnected }
}
