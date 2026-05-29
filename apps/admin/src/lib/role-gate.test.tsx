import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { RequireRole, useAdminUser, ROUTE_ROLES } from './role-gate'

describe('RequireRole', () => {
  test('renders children when user has allowed role', () => {
    renderWithProviders(
      <RequireRole allowed={['super']}>
        <div>Secret content</div>
      </RequireRole>,
      { user: MOCK_SUPER_ADMIN },
    )
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  test('shows access denied when user role is not allowed', () => {
    renderWithProviders(
      <RequireRole allowed={['super']}>
        <div>Secret content</div>
      </RequireRole>,
      { user: MOCK_ANALYST_ADMIN },
    )
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument()
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('shows required roles in access denied message', () => {
    renderWithProviders(
      <RequireRole allowed={['super', 'support']}>
        <div>Content</div>
      </RequireRole>,
      { user: MOCK_ANALYST_ADMIN },
    )
    expect(screen.getByText('super, support')).toBeInTheDocument()
  })

  test('shows current user role in access denied message', () => {
    renderWithProviders(
      <RequireRole allowed={['super']}>
        <div>Content</div>
      </RequireRole>,
      { user: MOCK_ANALYST_ADMIN },
    )
    expect(screen.getByText('analyst')).toBeInTheDocument()
  })

  test('allows support user when support is in allowed list', () => {
    renderWithProviders(
      <RequireRole allowed={['super', 'support']}>
        <div>Support content</div>
      </RequireRole>,
      { user: MOCK_SUPPORT_ADMIN },
    )
    expect(screen.getByText('Support content')).toBeInTheDocument()
  })

  test('allows analyst user when analyst is in allowed list', () => {
    renderWithProviders(
      <RequireRole allowed={['analyst']}>
        <div>Analytics view</div>
      </RequireRole>,
      { user: MOCK_ANALYST_ADMIN },
    )
    expect(screen.getByText('Analytics view')).toBeInTheDocument()
  })
})

describe('ROUTE_ROLES', () => {
  test('defines roles for all expected routes', () => {
    const expectedRoutes = [
      '/',
      '/associations',
      '/organizations',
      '/members',
      '/verifications',
      '/compliance',
      '/events',
      '/training',
      '/national-dashboard',
      '/committees',
      '/operators',
      '/impersonate',
      '/feature-flags',
      '/audit',
      '/surveys',
      '/communications',
      '/communications/moderation',
      '/communications/templates',
      '/communications/email',
    ]

    for (const route of expectedRoutes) {
      expect(ROUTE_ROLES[route]).toBeDefined()
      expect(Array.isArray(ROUTE_ROLES[route])).toBe(true)
      expect(ROUTE_ROLES[route]!.length).toBeGreaterThan(0)
    }
  })

  test('super role has access to all routes', () => {
    for (const [route, roles] of Object.entries(ROUTE_ROLES)) {
      expect(roles).toContain('super')
    }
  })

  test('operator-only routes restrict to super role', () => {
    expect(ROUTE_ROLES['/operators']).toEqual(['super'])
    expect(ROUTE_ROLES['/impersonate']).toEqual(['super'])
    expect(ROUTE_ROLES['/feature-flags']).toEqual(['super'])
  })

  test('dashboard is accessible to all roles', () => {
    expect(ROUTE_ROLES['/']).toContain('super')
    expect(ROUTE_ROLES['/']).toContain('support')
    expect(ROUTE_ROLES['/']).toContain('analyst')
  })

  test('[EM-M14] national-dashboard restricted to super only (matches backend isPlatformAdmin)', () => {
    expect(ROUTE_ROLES['/national-dashboard']).toEqual(['super'])
  })
})

describe('useAdminUser', () => {
  test('returns the admin user from context', () => {
    function TestComponent() {
      const user = useAdminUser()
      return <div data-testid="email">{user.email}</div>
    }

    renderWithProviders(<TestComponent />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByTestId('email')).toHaveTextContent('admin@test.com')
  })

  test('throws when used outside provider', () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function TestComponent() {
      const user = useAdminUser()
      return <div>{user.email}</div>
    }

    expect(() => {
      // Render without AdminUserContext provider
      render(<TestComponent />)
    }).toThrow('useAdminUser must be used within AdminUserContext.Provider')

    spy.mockRestore()
  })
})
