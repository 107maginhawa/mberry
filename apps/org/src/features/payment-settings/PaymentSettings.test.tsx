// apps/org/src/features/payment-settings/PaymentSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock router — unit tests don't need a full router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock useSelectedOrg (relative path — @/ alias unreliable at vitest runtime in apps/org)
vi.mock('../org/use-org', () => ({
  useSelectedOrg: vi.fn(),
}))

// Mock useGatewayConfig (relative — same module directory)
vi.mock('./use-gateway-config', () => ({
  useGatewayConfig: vi.fn(),
}))

import { useSelectedOrg } from '../org/use-org'
import { useGatewayConfig } from './use-gateway-config'
import { PaymentSettings } from './PaymentSettings'
import { toast } from 'sonner'

type HookReturn = ReturnType<typeof useGatewayConfig>

function mockHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    statusQuery: {
      isLoading: false,
      isError: false,
      data: undefined,
      error: null,
    } as any,
    connect: {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
      isError: false,
      error: null,
    } as any,
    test: {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ success: true, message: 'Test passed.', testedAt: new Date() }),
      isPending: false,
    } as any,
    disconnect: {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as any,
    ...overrides,
  }
}

describe('PaymentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSelectedOrg).mockReturnValue({ orgId: 'org-1', setOrgId: vi.fn() })
    vi.mocked(useGatewayConfig).mockReturnValue(mockHook())
  })

  it('shows "Select an organization first" when no orgId', () => {
    vi.mocked(useSelectedOrg).mockReturnValue({ orgId: null, setOrgId: vi.fn() })
    render(<PaymentSettings />)
    expect(screen.getByText(/select an organization first/i)).toBeInTheDocument()
  })

  it('shows the connect form when not connected', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({ statusQuery: { isLoading: false, isError: false, data: { connected: false }, error: null } as any })
    )
    render(<PaymentSettings />)
    expect(screen.getByLabelText(/payMongo public key/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/secret key/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/webhook signing secret/i)).toBeInTheDocument()
    expect(screen.getByText(/not connected/i)).toBeInTheDocument()
  })

  it('shows a Connected status badge when connected', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: false,
          data: { connected: true, publicKey: 'pk_live_abc', provider: 'paymongo' },
          error: null,
        } as any,
      })
    )
    render(<PaymentSettings />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows test-mode badge when public key starts with pk_test_', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: false,
          data: { connected: true, publicKey: 'pk_test_xyz', provider: 'paymongo' },
          error: null,
        } as any,
      })
    )
    render(<PaymentSettings />)
    expect(screen.getByText(/test mode/i)).toBeInTheDocument()
  })

  it('shows public key plain (not masked) when connected', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: false,
          data: { connected: true, publicKey: 'pk_live_abc123', provider: 'paymongo' },
          error: null,
        } as any,
      })
    )
    render(<PaymentSettings />)
    expect(screen.getByText(/pk_live_abc123/)).toBeInTheDocument()
  })

  it('secret key and webhook secret inputs are type="password"', () => {
    render(<PaymentSettings />)
    const secretInput = screen.getByLabelText(/secret key/i)
    const webhookInput = screen.getByLabelText(/webhook signing secret/i)
    expect(secretInput).toHaveAttribute('type', 'password')
    expect(webhookInput).toHaveAttribute('type', 'password')
  })

  it('public key input is type="text" (non-secret)', () => {
    render(<PaymentSettings />)
    const pubKeyInput = screen.getByLabelText(/public key/i)
    expect(pubKeyInput).toHaveAttribute('type', 'text')
  })

  it('webhook URL shows orgId', () => {
    render(<PaymentSettings />)
    expect(screen.getByText(/webhooks\/paymongo\/org-1/)).toBeInTheDocument()
  })

  it('submitting the form calls connect.mutate with entered values', async () => {
    const connect = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null }
    vi.mocked(useGatewayConfig).mockReturnValue(mockHook({ connect: connect as any }))
    render(<PaymentSettings />)

    await userEvent.type(screen.getByLabelText(/payMongo public key/i), 'pk_test_pub')
    await userEvent.type(screen.getByLabelText(/secret key/i), 'sk_test_sec')
    await userEvent.type(screen.getByLabelText(/webhook signing secret/i), 'whsec_hook')
    await userEvent.click(screen.getByRole('button', { name: /connect paymongo/i }))

    expect(connect.mutate).toHaveBeenCalledWith(
      { publicKey: 'pk_test_pub', secretKey: 'sk_test_sec', webhookSecret: 'whsec_hook' },
      expect.any(Object),
    )
  })

  it('secret key input is never pre-filled from server (value is empty)', () => {
    // Server never returns secrets; the input must always start empty.
    // Note: label text and webhook instructions may reference "sk_" format hints — that is intentional.
    render(<PaymentSettings />)
    const secretInput = screen.getByLabelText(/secret key/i) as HTMLInputElement
    expect(secretInput.value).toBe('')
  })

  it('shows error role="alert" when connect fails', async () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        connect: {
          mutate: vi.fn().mockImplementation((_vars, opts) => {
            opts?.onError?.(new Error('Officer access required. Ensure 2FA is enabled.'))
          }),
          mutateAsync: vi.fn(),
          isPending: false,
          isError: false,
          error: null,
        } as any,
      })
    )
    render(<PaymentSettings />)
    // Fill required fields so the form submits (required attrs block empty submit in jsdom)
    await userEvent.type(screen.getByLabelText(/payMongo public key/i), 'pk_test_pub')
    await userEvent.type(screen.getByLabelText(/secret key/i), 'sk_test_sec')
    await userEvent.click(screen.getByRole('button', { name: /connect paymongo/i }))
    // mutate mock calls onError synchronously → setConnectError → re-render → role="alert"
    expect(screen.getByRole('alert')).toHaveTextContent(/two-factor|officer access|could not/i)
  })

  it('shows Test connection and Disconnect buttons when connected', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: false,
          data: { connected: true, publicKey: 'pk_live_x', provider: 'paymongo' },
          error: null,
        } as any,
      })
    )
    render(<PaymentSettings />)
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('Test connection button calls test.mutateAsync and toasts result', async () => {
    const testMutateAsync = vi.fn().mockResolvedValue({ success: true, message: 'All good.', testedAt: new Date() })
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: false,
          data: { connected: true, publicKey: 'pk_live_x', provider: 'paymongo' },
          error: null,
        } as any,
        test: { mutate: vi.fn(), mutateAsync: testMutateAsync, isPending: false } as any,
      })
    )
    render(<PaymentSettings />)
    await userEvent.click(screen.getByRole('button', { name: /test connection/i }))
    expect(testMutateAsync).toHaveBeenCalled()
    expect(vi.mocked(toast.success)).toHaveBeenCalled()
  })

  it('Disconnect opens a confirm dialog and only disconnects after confirming', async () => {
    const disconnectMutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: false,
          data: { connected: true, publicKey: 'pk_live_x', provider: 'paymongo' },
          error: null,
        } as any,
        disconnect: { mutate: vi.fn(), mutateAsync: disconnectMutateAsync, isPending: false } as any,
      })
    )
    render(<PaymentSettings />)
    // Click the trigger — does NOT disconnect yet (no native window.confirm)
    await userEvent.click(screen.getByRole('button', { name: /^disconnect$/i }))
    expect(disconnectMutateAsync).not.toHaveBeenCalled()
    // Confirm inside the dialog
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /disconnect/i }))
    expect(disconnectMutateAsync).toHaveBeenCalled()
  })

  it('shows role="alert" on statusQuery error (e.g. 403 → officer note)', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: true,
          data: undefined,
          error: new Error('Forbidden'),
        } as any,
      })
    )
    render(<PaymentSettings />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('error: Try again calls statusQuery.refetch', () => {
    const refetch = vi.fn()
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: {
          isLoading: false,
          isError: true,
          data: undefined,
          error: new Error('Forbidden'),
          refetch,
        } as any,
      })
    )
    render(<PaymentSettings />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows loading skeleton while statusQuery.isLoading', () => {
    vi.mocked(useGatewayConfig).mockReturnValue(
      mockHook({
        statusQuery: { isLoading: true, isError: false, data: undefined, error: null } as any,
      })
    )
    render(<PaymentSettings />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders the 2FA officer note', () => {
    render(<PaymentSettings />)
    expect(screen.getByText(/Treasurer or President/i)).toBeInTheDocument()
    expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument()
  })
})
