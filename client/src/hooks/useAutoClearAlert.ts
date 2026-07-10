import { useEffect } from 'react'

export function useAutoClearAlert(
  value: string | null,
  setter: (val: string | null) => void,
  ms: number = 10000
) {
  useEffect(() => {
    if (value !== null) {
      const t = setTimeout(() => setter(null), ms)
      return () => clearTimeout(t)
    }
  }, [value, setter, ms])
}
