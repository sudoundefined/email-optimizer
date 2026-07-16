import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 → target over `duration` ms (ease-out), respecting
 * prefers-reduced-motion (jumps straight to the target). Restarts when target
 * changes. Returns the current display value.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || duration <= 0 || target === 0) {
      setValue(target)
      return
    }
    let start: number | null = null
    const step = (t: number) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setValue(target * eased)
      if (p < 1) frame.current = requestAnimationFrame(step)
      else setValue(target)
    }
    frame.current = requestAnimationFrame(step)
    return () => { if (frame.current) cancelAnimationFrame(frame.current) }
  }, [target, duration])

  return value
}
