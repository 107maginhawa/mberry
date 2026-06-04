import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { AlertBanner } from './alert-banner'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params?: Record<string, string> }) => (
    <a href={String(to)} data-params={JSON.stringify(params)}>{children}</a>
  ),
}))

const emptyProps = { memberships: [], invoices: [], elections: [] }

describe('AlertBanner', () => {
  test('renders nothing when no alerts', () => {
    const { container } = renderWithProviders(<AlertBanner {...emptyProps} />)

    expect(container.firstChild).toBeNull()
  })

  test('shows overdue invoice alert', () => {
    renderWithProviders(
      <AlertBanner
        memberships={[]}
        invoices={[{ status: 'overdue', organizationId: 'org-1' }]}
        elections={[]}
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Dues overdue/)).toBeInTheDocument()
    expect(screen.getByText('Pay now')).toBeInTheDocument()
  })

  test('shows plural for multiple overdue invoices', () => {
    renderWithProviders(
      <AlertBanner
        memberships={[]}
        invoices={[
          { status: 'overdue', organizationId: 'org-1' },
          { status: 'overdue', organizationId: 'org-1' },
        ]}
        elections={[]}
      />
    )

    expect(screen.getByText(/2 unpaid invoices/)).toBeInTheDocument()
  })

  test('shows dues expiring warning within 30 days', () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()

    renderWithProviders(
      <AlertBanner
        memberships={[{
          orgId: 'org-1',
          orgName: 'PDA',
          status: 'grace',
          duesExpiryDate: futureDate,
        }]}
        invoices={[{ status: 'sent', organizationId: 'org-1' }]}
        elections={[]}
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Dues expire in.*day/)).toBeInTheDocument()
  })

  test('shows expired dues alert', () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

    renderWithProviders(
      <AlertBanner
        memberships={[{
          orgId: 'org-1',
          orgName: 'Manila Dental Society',
          status: 'lapsed',
          duesExpiryDate: pastDate,
        }]}
        invoices={[{ status: 'sent', organizationId: 'org-1' }]}
        elections={[]}
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Dues expired for Manila Dental Society/)).toBeInTheDocument()
    expect(screen.getByText('Renew now')).toBeInTheDocument()
  })

  test('shows election voting alert when voting window is open', () => {
    const votingStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const votingEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

    renderWithProviders(
      <AlertBanner
        memberships={[]}
        invoices={[]}
        elections={[{
          id: 'elec-1',
          title: 'Board Elections 2025',
          status: 'active',
          votingStart,
          votingEnd,
          organizationId: 'org-1',
        }]}
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Board Elections 2025/)).toBeInTheDocument()
    expect(screen.getByText('Vote')).toBeInTheDocument()
  })

  test('does not show election alert when voting not started', () => {
    const futureStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const futureEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()

    const { container } = renderWithProviders(
      <AlertBanner
        memberships={[]}
        invoices={[]}
        elections={[{
          id: 'elec-1',
          title: 'Board Elections 2025',
          status: 'active',
          votingStart: futureStart,
          votingEnd: futureEnd,
          organizationId: 'org-1',
        }]}
      />
    )

    // No alert rendered since voting hasn't started
    expect(container.firstChild).toBeNull()
  })

  test('prioritizes overdue invoices over other alerts', () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    const votingStart = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    const votingEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

    renderWithProviders(
      <AlertBanner
        memberships={[{
          orgId: 'org-1',
          orgName: 'PDA',
          status: 'grace',
          duesExpiryDate: futureDate,
        }]}
        invoices={[{ status: 'overdue', organizationId: 'org-1' }]}
        elections={[{
          id: 'elec-1',
          title: 'Board Elections',
          status: 'active',
          votingStart,
          votingEnd,
          organizationId: 'org-1',
        }]}
      />
    )

    // Only shows overdue (highest priority)
    expect(screen.getByText(/Dues overdue/)).toBeInTheDocument()
  })

  test('shows pending invoices alert when no overdue', () => {
    renderWithProviders(
      <AlertBanner
        memberships={[]}
        invoices={[
          { status: 'sent', organizationId: 'org-1' },
          { status: 'sent', organizationId: 'org-1' },
        ]}
        elections={[]}
      />
    )

    expect(screen.getByText(/2 pending invoices awaiting payment/)).toBeInTheDocument()
    expect(screen.getByText('Pay dues')).toBeInTheDocument()
  })

  test('skips expiry warning for active members with paid dues', () => {
    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()

    const { container } = renderWithProviders(
      <AlertBanner
        memberships={[{
          orgId: 'org-1',
          orgName: 'PDA',
          status: 'active',
          duesExpiryDate: futureDate,
        }]}
        invoices={[{ status: 'paid', organizationId: 'org-1' }]}
        elections={[]}
      />
    )

    // Active with paid dues = no alert
    expect(container.firstChild).toBeNull()
  })
})
