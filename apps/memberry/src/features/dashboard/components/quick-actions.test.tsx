import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { QuickActions } from './quick-actions'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params?: Record<string, string> }) => (
    <a href={String(to)} data-params={JSON.stringify(params)}>{children}</a>
  ),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

describe('QuickActions', () => {
  test('renders all 6 action buttons', () => {
    renderWithProviders(<QuickActions />)

    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByText('ID Card')).toBeInTheDocument()
    expect(screen.getByText('Certificates')).toBeInTheDocument()
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.getByText('Credits')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  test('renders Quick Actions heading', () => {
    renderWithProviders(<QuickActions />)

    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
  })

  test('shows Pay Dues when duesOrgId is provided', () => {
    renderWithProviders(<QuickActions duesOrgId="org-123" />)

    expect(screen.getByText('Pay Dues')).toBeInTheDocument()
    // Should NOT show generic "Payments"
    expect(screen.queryByText('Payments')).not.toBeInTheDocument()
  })

  test('shows Payments when duesOrgId is not provided', () => {
    renderWithProviders(<QuickActions />)

    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.queryByText('Pay Dues')).not.toBeInTheDocument()
  })

  test('links to org-specific dues route when duesOrgId provided', () => {
    renderWithProviders(<QuickActions duesOrgId="org-abc" />)

    const payDuesLink = screen.getByText('Pay Dues').closest('a')
    expect(payDuesLink).toHaveAttribute('href', '/org/$orgSlug/dues')
  })

  test('links to org-specific events route when eventsOrgId provided', () => {
    renderWithProviders(<QuickActions eventsOrgId="org-evt-1" />)

    const eventsLink = screen.getByText('Events').closest('a')
    expect(eventsLink).toHaveAttribute('href', '/org/$orgSlug/events')
  })

  test('links to /my/events when no eventsOrgId', () => {
    renderWithProviders(<QuickActions />)

    const eventsLink = screen.getByText('Events').closest('a')
    expect(eventsLink).toHaveAttribute('href', '/my/events')
  })
})
