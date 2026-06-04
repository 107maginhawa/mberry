import type { ComponentType } from 'react'
import { cn } from '../lib/utils'

const NAV_ICON_SIZES = { sm: 18, lg: 22 } as const

type NavIconSize = keyof typeof NAV_ICON_SIZES

/**
 * Loose icon type — covers both `LucideIcon` (forwardRef'd SVG component) and
 * the `ComponentType<{ size?: number; className?: string }>` shape that older
 * call-sites use when icons are passed as destructured props.
 */
type IconLike = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>

interface NavIconProps {
  icon: IconLike
  size?: NavIconSize
  className?: string
  'aria-hidden'?: boolean
}

export function NavIcon({ icon: Icon, size = 'sm', className, 'aria-hidden': ariaHidden }: NavIconProps) {
  return <Icon size={NAV_ICON_SIZES[size]} className={cn('shrink-0', className)} aria-hidden={ariaHidden} />
}
