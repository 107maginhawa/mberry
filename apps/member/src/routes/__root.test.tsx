import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Mock all TanStack Router hooks — must precede any import of the component.
const mockNavigate = vi.fn()
let mockPathname = '/'

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (opts: unknown) => opts,
  Outlet: () => <div data-testid="outlet" />,
  useNavigate: () => mockNavigate,
  useRouterState: (opts: { select: (s: { location: { pathname: string } }) => string }) =>
    opts.select({ location: { pathname: mockPathname } }),
}))

vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn() }))
import { getMyMemberships } from '@monobase/sdk-ts/generated'

vi.mock('@/features/auth/use-session', () => ({ useSession: vi.fn() }))
import { useSession } from '@/features/auth/use-session'

import { RootGate } from './__root'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  )
}

describe('RootGate guard', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    vi.mocked(getMyMemberships).mockClear()
    mockPathname = '/'
  })

  it('renders Outlet on /pay/:token — no session probe, no redirect', () => {
    mockPathname = '/pay/abc-token'
    // [review m7] when isPublic=true, useSession is called with false → status:'loading'
    vi.mocked(useSession).mockReturnValue({ status: 'loading' })

    render(<RootGate />, { wrapper })

    // useSession must be called with false (disabled) — no probe on public path
    expect(useSession).toHaveBeenCalledWith(false)
    // getMyMemberships is never reached when useSession is disabled
    expect(getMyMemberships).not.toHaveBeenCalled()
    // isPublic=true → Outlet rendered regardless of loading status
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    // No redirect
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('redirects to /sign-in when unauthed on protected path', async () => {
    mockPathname = '/dashboard'
    vi.mocked(useSession).mockReturnValue({ status: 'unauthed' })

    render(<RootGate />, { wrapper })

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in' }),
    )
  })

  it('renders Outlet when authed on protected path', () => {
    mockPathname = '/dashboard'
    vi.mocked(useSession).mockReturnValue({ status: 'authed', memberships: [] })

    render(<RootGate />, { wrapper })

    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows loading spinner when session pending on protected path', () => {
    mockPathname = '/dashboard'
    vi.mocked(useSession).mockReturnValue({ status: 'loading' })

    render(<RootGate />, { wrapper })

    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
