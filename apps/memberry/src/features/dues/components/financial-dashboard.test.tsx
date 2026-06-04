import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { FinancialDashboard } from './financial-dashboard'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/motion/count-up', () => ({
  CountUp: ({ value, format, prefix }: any) => (
    <span>{format ? format(value) : `${prefix ?? ''}${value}`}</span>
  ),
}))

vi.mock('@/components/motion/stagger-grid', () => ({
  StaggerGrid: ({ children, className }: any) => <div className={className}>{children}</div>,
  StaggerItem: ({ children }: any) => <div>{children}</div>,
}))

// Router (Link, useParams) provided by global mock in test-setup-root.ts;
// __routerParams set per test in beforeEach.

import { getDuesFinancialDashboardOptions } from '@monobase/sdk-ts/generated/react-query'

const mockGetDashboard = getDuesFinancialDashboardOptions as ReturnType<typeof vi.fn>

describe('FinancialDashboard', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
  })

  test('shows loading skeletons while data loads', () => {
    mockGetDashboard.mockReturnValue({
      queryKey: ['dues', 'dashboard', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    const { container } = renderWithProviders(<FinancialDashboard orgId="org-1" />)
    // 4 skeleton placeholders
    const skeletons = container.querySelectorAll('.animate-shimmer')
    expect(skeletons.length).toBe(4)
  })

  test('renders dashboard metrics when data loads', async () => {
    mockGetDashboard.mockReturnValue({
      queryKey: ['dues', 'dashboard', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          collectionRate: 85,
          totalCollected: 500000,
          totalOutstanding: 100000,
          pendingCount: 3,
          expiringThisMonth: 2,
          gatewayConfigured: true,
        }),
    })

    renderWithProviders(<FinancialDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Collection Rate')).toBeInTheDocument()
      expect(screen.getByText('Total Collected')).toBeInTheDocument()
      expect(screen.getByText('Outstanding')).toBeInTheDocument()
      expect(screen.getByText('Pending Payments')).toBeInTheDocument()
    })
  })

  test('shows expiring dues alert when expiringThisMonth > 0', async () => {
    mockGetDashboard.mockReturnValue({
      queryKey: ['dues', 'dashboard', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          collectionRate: 70,
          totalCollected: 0,
          totalOutstanding: 0,
          pendingCount: 0,
          expiringThisMonth: 5,
          gatewayConfigured: true,
        }),
    })

    renderWithProviders(<FinancialDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('5 members with expiring dues')).toBeInTheDocument()
    })
  })

  test('shows gateway not configured card when gateway is false', async () => {
    mockGetDashboard.mockReturnValue({
      queryKey: ['dues', 'dashboard', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          collectionRate: 0,
          totalCollected: 0,
          totalOutstanding: 0,
          pendingCount: 0,
          expiringThisMonth: 0,
          gatewayConfigured: false,
        }),
    })

    renderWithProviders(<FinancialDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Gateway not configured')).toBeInTheDocument()
      expect(screen.getByText('Set up online payments')).toBeInTheDocument()
    })
  })

  test('hides action cards when no alerts needed', async () => {
    mockGetDashboard.mockReturnValue({
      queryKey: ['dues', 'dashboard', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          collectionRate: 90,
          totalCollected: 1000000,
          totalOutstanding: 0,
          pendingCount: 0,
          expiringThisMonth: 0,
          gatewayConfigured: true,
        }),
    })

    renderWithProviders(<FinancialDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Collection Rate')).toBeInTheDocument()
    })

    expect(screen.queryByText('Gateway not configured')).not.toBeInTheDocument()
    expect(screen.queryByText(/members with expiring dues/)).not.toBeInTheDocument()
  })
})
