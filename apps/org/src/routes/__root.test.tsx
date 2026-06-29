import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockNavigate = vi.fn()
let mockPathname = '/'
let sessionStatus: 'loading' | 'authed' | 'unauthed' = 'authed'

// Capture RootGate via the mocked createRootRoute so we can render it directly.
vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (opts: { component: () => ReactNode }) => ({ options: opts }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  Outlet: () => <div data-testid="outlet" />,
  useNavigate: () => mockNavigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: mockPathname } }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/features/auth/use-session', () => ({ useSession: () => ({ status: sessionStatus }) }))
vi.mock('@/features/auth/sign-in', () => ({ signOut: vi.fn() }))

import { toast } from 'sonner'
import { signOut } from '@/features/auth/sign-in'
import { Route } from './__root'

const RootGate = (Route as unknown as { options: { component: () => ReactNode } }).options.component

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  mockPathname = '/'
  sessionStatus = 'authed'
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
})

describe('RootGate sign-out (Fix 1)', () => {
  it('failed sign-out shows a toast and does NOT navigate', async () => {
    vi.mocked(signOut).mockResolvedValue({ ok: false, error: 'Could not sign out' })
    render(<RootGate />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not sign out'))
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it('successful sign-out invalidates session and navigates to /sign-in', async () => {
    vi.mocked(signOut).mockResolvedValue({ ok: true })
    render(<RootGate />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in' }))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['session'] })
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('RootGate redirect (Fix 2)', () => {
  it('redirects an already-authed user away from /sign-in to /', async () => {
    sessionStatus = 'authed'
    mockPathname = '/sign-in'
    render(<RootGate />, { wrapper })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }))
  })

  it('does NOT redirect an authed user already on a protected route (no loop)', async () => {
    sessionStatus = 'authed'
    mockPathname = '/'
    render(<RootGate />, { wrapper })
    await Promise.resolve()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
