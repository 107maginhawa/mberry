import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DuesSetupChecklist } from './dues-setup-checklist'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
}))

import { getDuesConfigOptions, getDuesGatewayConfigOptions, listDuesFundsOptions } from '@monobase/sdk-ts/generated/react-query'

const mockConfig = getDuesConfigOptions as ReturnType<typeof vi.fn>
const mockGateway = getDuesGatewayConfigOptions as ReturnType<typeof vi.fn>
const mockFunds = listDuesFundsOptions as ReturnType<typeof vi.fn>

function setupMocks(overrides: {
  config?: any
  gateway?: any
  funds?: any
} = {}) {
  const config = overrides.config ?? null
  const gateway = overrides.gateway ?? null
  const funds = overrides.funds ?? []

  mockConfig.mockReturnValue({
    queryKey: ['dues', 'config', 'org-1'],
    queryFn: () => Promise.resolve(config),
  })
  mockGateway.mockReturnValue({
    queryKey: ['dues', 'gateway', 'org-1'],
    queryFn: () => Promise.resolve(gateway),
  })
  mockFunds.mockReturnValue({
    queryKey: ['dues', 'funds', 'org-1'],
    queryFn: () => Promise.resolve(funds),
  })
}

describe('DuesSetupChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders all 4 steps when nothing configured', async () => {
    setupMocks()

    renderWithProviders(<DuesSetupChecklist orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Set dues amount')).toBeInTheDocument()
    })

    expect(screen.getByText('Configure billing schedule')).toBeInTheDocument()
    expect(screen.getByText('Connect payment gateway')).toBeInTheDocument()
    expect(screen.getByText('Set up fund allocation')).toBeInTheDocument()
    expect(screen.getByText('0 of 4 steps complete')).toBeInTheDocument()
  })

  test('hides when all 4 steps complete', async () => {
    setupMocks({
      config: { annualAmount: 50000, billingFrequency: 'annual' },
      gateway: { connected: true },
      funds: [{ fundId: 'general', name: 'General Fund' }],
    })

    renderWithProviders(<DuesSetupChecklist orgId="org-1" />)

    // Wait for queries to resolve, then verify checklist is gone
    await waitFor(() => {
      expect(screen.queryByTestId('dues-setup-checklist')).not.toBeInTheDocument()
    })
  })

  test('shows correct links per step', async () => {
    setupMocks()

    renderWithProviders(<DuesSetupChecklist orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Set dues amount')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))

    // Dues amount and billing schedule link to /settings/dues
    expect(hrefs.filter((h) => h?.includes('/officer/settings/dues'))).toHaveLength(2)
    // Gateway links to /settings/gateway
    expect(hrefs.filter((h) => h?.includes('/officer/settings/gateway'))).toHaveLength(1)
    // Funds links to /settings/funds
    expect(hrefs.filter((h) => h?.includes('/officer/settings/funds'))).toHaveLength(1)
  })

  test('re-appears when a step regresses (gateway disconnected)', async () => {
    // First render: all complete
    setupMocks({
      config: { annualAmount: 50000, billingFrequency: 'annual' },
      gateway: { connected: true },
      funds: [{ fundId: 'general', name: 'General Fund' }],
    })

    const { unmount } = renderWithProviders(<DuesSetupChecklist orgId="org-1" />)

    await waitFor(() => {
      expect(screen.queryByTestId('dues-setup-checklist')).not.toBeInTheDocument()
    })

    unmount()

    // Second render: gateway disconnected
    setupMocks({
      config: { annualAmount: 50000, billingFrequency: 'annual' },
      gateway: { connected: false },
      funds: [{ fundId: 'general', name: 'General Fund' }],
    })

    renderWithProviders(<DuesSetupChecklist orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('dues-setup-checklist')).toBeInTheDocument()
    })

    expect(screen.getByText('3 of 4 steps complete')).toBeInTheDocument()
    expect(screen.getByText('Connect payment gateway')).toBeInTheDocument()
  })

  test('shows partial completion correctly', async () => {
    setupMocks({
      config: { annualAmount: 50000 },
      gateway: null,
      funds: [{ fundId: 'general', name: 'General Fund' }],
    })

    renderWithProviders(<DuesSetupChecklist orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('2 of 4 steps complete')).toBeInTheDocument()
    })
  })
})
