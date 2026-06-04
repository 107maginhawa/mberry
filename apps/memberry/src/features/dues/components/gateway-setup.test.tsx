import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { GatewaySetup } from './gateway-setup'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { getDuesGatewayConfigOptions } from '@monobase/sdk-ts/generated/react-query'

const mockGetConfig = getDuesGatewayConfigOptions as ReturnType<typeof vi.fn>

describe('GatewaySetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeleton while config loads', () => {
    mockGetConfig.mockReturnValue({
      queryKey: ['dues', 'gateway', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    const { container } = renderWithProviders(<GatewaySetup orgId="org-1" />)
    // Skeleton should be present
    expect(container.querySelector('[class*="h-64"]')).toBeTruthy()
  })

  test('shows not-connected state with setup form', async () => {
    mockGetConfig.mockReturnValue({
      queryKey: ['dues', 'gateway', 'org-1'],
      queryFn: () => Promise.resolve({ connected: false }),
    })

    renderWithProviders(<GatewaySetup orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Not Connected')).toBeInTheDocument()
    })

    expect(screen.getByText('Connect a payment gateway to accept online payments.')).toBeInTheDocument()
    expect(screen.getByText('Gateway Provider')).toBeInTheDocument()
    expect(screen.getByText('Public Key')).toBeInTheDocument()
    expect(screen.getByText('Secret Key')).toBeInTheDocument()
    expect(screen.getByText('Test Connection')).toBeInTheDocument()
    expect(screen.getByText('Save & Activate')).toBeInTheDocument()
  })

  test('shows connected state with disconnect button', async () => {
    mockGetConfig.mockReturnValue({
      queryKey: ['dues', 'gateway', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          connected: true,
          provider: 'paymongo',
          publicKeyLast4: '1234',
          lastTestAt: '2025-03-15T00:00:00Z',
        }),
    })

    renderWithProviders(<GatewaySetup orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    expect(screen.getByText(/PayMongo/)).toBeInTheDocument()
    expect(screen.getByText(/····1234/)).toBeInTheDocument()
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  test('Test Connection button is disabled without keys', async () => {
    mockGetConfig.mockReturnValue({
      queryKey: ['dues', 'gateway', 'org-1'],
      queryFn: () => Promise.resolve({ connected: false }),
    })

    renderWithProviders(<GatewaySetup orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test Connection')).toBeInTheDocument()
    })

    expect(screen.getByText('Test Connection').closest('button')).toBeDisabled()
  })

  test('Save & Activate button is disabled without successful test', async () => {
    mockGetConfig.mockReturnValue({
      queryKey: ['dues', 'gateway', 'org-1'],
      queryFn: () => Promise.resolve({ connected: false }),
    })

    renderWithProviders(<GatewaySetup orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Save & Activate')).toBeInTheDocument()
    })

    expect(screen.getByText('Save & Activate').closest('button')).toBeDisabled()
  })
})
