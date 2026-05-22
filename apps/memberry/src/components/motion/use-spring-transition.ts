import type { Transition, Variants } from 'framer-motion'

/** Shared spring config — matches DESIGN.md motion spec */
export const SPRING_CONFIG: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 300,
  mass: 0.5,
}

/** Page-level fade+slide transition variants */
export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

/**
 * Returns motion props for page/content transitions.
 * Drop these directly onto a <motion.div>.
 */
export function useSpringTransition() {
  return {
    variants: pageTransitionVariants,
    initial: 'initial' as const,
    animate: 'animate' as const,
    exit: 'exit' as const,
    transition: SPRING_CONFIG,
  }
}
