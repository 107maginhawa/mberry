import type { ComponentProps, ReactNode } from 'react'
import { Button } from './button'
import { cn } from '../lib/utils'

const ROUND_DIMS = {
  sm: 'h-8 w-8',    // 32px — avatar / inline ops
  md: 'h-12 w-12',  // 48px — secondary call control
  lg: 'h-14 w-14',  // 56px — primary call control
} as const

type RoundSize = keyof typeof ROUND_DIMS

interface RoundActionButtonProps extends Omit<ComponentProps<typeof Button>, 'size'> {
  size?: RoundSize
  children: ReactNode
}

/**
 * RoundActionButton — circular icon-only action button at canonical sizes
 * (32 / 48 / 56). Wraps Button with `size="icon"` + rounded-full + fixed
 * dimensions so call-site className overrides aren't required.
 *
 * For brand-red destructive emphasis (e.g. end-call) pass `variant="destructive"`
 * — additional `bg-red-600 hover:bg-red-700` overrides are still callable via
 * `className` when stronger emphasis is needed.
 */
export function RoundActionButton({ size = 'md', className, children, ...rest }: RoundActionButtonProps) {
  return (
    <Button
      size="icon"
      className={cn('rounded-full', ROUND_DIMS[size], className)}
      {...rest}
    >
      {children}
    </Button>
  )
}
