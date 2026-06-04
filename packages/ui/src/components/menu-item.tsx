import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode
  /** Apply destructive (error) text color — for "Delete", "Cancel", etc. */
  destructive?: boolean
}

/**
 * MenuItem — dropdown menu row primitive. Renders a full-width button with
 * canonical menu padding (`px-3 py-1.5`) and surface-warm hover; intended to
 * sit inside a custom dropdown popover. For shadcn DropdownMenu primitives use
 * `DropdownMenuItem` instead — this is for the lightweight popover pattern.
 */
export function MenuItem({ children, destructive, className, type, ...rest }: MenuItemProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'w-full text-left px-3 py-1.5 hover:bg-[var(--color-surface-warm)] focus:outline-none focus:bg-[var(--color-surface-warm)]',
        destructive && 'text-[var(--color-error)]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
