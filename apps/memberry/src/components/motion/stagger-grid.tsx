import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SPRING_CONFIG } from './use-spring-transition'

interface StaggerGridProps {
  children: ReactNode
  className?: string
  /** Delay between each child (default 0.06s) */
  staggerDelay?: number
}

const containerVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_CONFIG,
  },
}

/**
 * Staggers children on initial mount (route entry).
 * No re-stagger on refetch — uses `once: true` via `viewport`.
 * Reduced-motion: renders instantly, no animation.
 */
export function StaggerGrid({ children, className, staggerDelay = 0.06 }: StaggerGridProps) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      custom={staggerDelay}
    >
      {children}
    </motion.div>
  )
}

/** Wrap each grid item in this for stagger effect */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
