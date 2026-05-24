import type { AdminUser } from '@/router'
import { createContext, useContext } from 'react'
import { ShieldAlert } from 'lucide-react'

type AdminRole = AdminUser['role']

/** React context for the authenticated admin user, set in main.tsx */
export const AdminUserContext = createContext<AdminUser | null>(null)

/**
 * Get the current admin user.
 * Must be called inside AdminUserContext.Provider (set in main.tsx after auth).
 */
export function useAdminUser(): AdminUser {
  const user = useContext(AdminUserContext)
  if (!user) throw new Error('useAdminUser must be used within AdminUserContext.Provider')
  return user
}

/**
 * Route-level role gate. Renders children only if the current admin
 * has one of the allowed roles; otherwise shows an access-denied message.
 */
export function RequireRole({
  allowed,
  children,
}: {
  allowed: AdminRole[]
  children: React.ReactNode
}) {
  const user = useAdminUser()

  if (!allowed.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <ShieldAlert className="w-12 h-12" />
        <h2 className="text-h2 text-foreground">Access Denied</h2>
        <p className="text-sm">
          This page requires one of the following roles:{' '}
          <span className="font-medium text-foreground">{allowed.join(', ')}</span>
        </p>
        <p className="text-sm">
          Your current role:{' '}
          <span className="font-medium text-foreground">{user.role}</span>
        </p>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Role-based access matrix for admin routes.
 * Used by the sidebar to filter visible nav items.
 */
export const ROUTE_ROLES: Record<string, AdminRole[]> = {
  '/': ['super', 'support', 'analyst'],
  '/associations': ['super', 'support', 'analyst'],
  '/organizations': ['super', 'support', 'analyst'],
  '/members': ['super', 'support', 'analyst'],
  '/verifications': ['super', 'support'],
  '/compliance': ['super', 'support', 'analyst'],
  '/events': ['super', 'support'],
  '/training': ['super', 'support', 'analyst'],
  '/national-dashboard': ['super', 'support', 'analyst'],
  '/committees': ['super', 'support'],
  '/operators': ['super'],
  '/impersonate': ['super'],
  '/feature-flags': ['super'],
  '/audit': ['super', 'support'],
  '/surveys': ['super', 'support', 'analyst'],
}
