import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

interface CountUpProps {
  /** Target value to animate to */
  value: number
  /** Duration in ms (default 800) */
  duration?: number
  /** Format function (default: toLocaleString) */
  format?: (n: number) => string
  /** Prefix (e.g. "₱") */
  prefix?: string
  /** Suffix (e.g. "%") */
  suffix?: string
  /** CSS class for the rendered span */
  className?: string
}

/**
 * Animate a number from 0 → value on first mount.
 * Subsequent value changes snap immediately (no re-animation on refetch).
 */
export function CountUp({
  value,
  duration = 800,
  format = (n) => n.toLocaleString(),
  prefix = '',
  suffix = '',
  className,
}: CountUpProps) {
  const reducedMotion = useReducedMotion()
  const hasAnimated = useRef(false)
  const [display, setDisplay] = useState(reducedMotion ? value : 0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    // After first animation, snap to new values
    if (hasAnimated.current || reducedMotion) {
      setDisplay(value)
      return
    }

    hasAnimated.current = true
    const start = performance.now()
    const from = 0
    const to = value

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const raw = from + (to - from) * eased
      // Preserve decimal precision of the target value
      const decimals = (String(to).split('.')[1] || '').length
      setDisplay(decimals > 0 ? parseFloat(raw.toFixed(decimals)) : Math.round(raw))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration, reducedMotion])

  return (
    <span className={className}>
      {prefix}{format(display)}{suffix}
    </span>
  )
}
