import React from 'react'
import { render, screen, within, waitFor, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminUserContext } from '@/lib/role-gate'
import type { AdminUser } from '@/router'
import type { ReactNode } from 'react'

/** Default super admin user for tests */
export const MOCK_SUPER_ADMIN: AdminUser = {
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'super',
}

export const MOCK_SUPPORT_ADMIN: AdminUser = {
  email: 'support@test.com',
  name: 'Support Admin',
  role: 'support',
}

export const MOCK_ANALYST_ADMIN: AdminUser = {
  email: 'analyst@test.com',
  name: 'Analyst Admin',
  role: 'analyst',
}

interface RenderOptions {
  user?: AdminUser
}

/**
 * Renders a component wrapped with QueryClientProvider and AdminUserContext.
 * Provides a super admin user by default.
 */
export function renderWithProviders(
  ui: ReactNode,
  options: RenderOptions = {},
): RenderResult {
  const { user = MOCK_SUPER_ADMIN } = options

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <AdminUserContext.Provider value={user}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </AdminUserContext.Provider>,
  )
}

export { screen, within, waitFor, userEvent }
