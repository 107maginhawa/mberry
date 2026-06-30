import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockNavigate = vi.fn()
let mockPathname = '/'
let sessionStatus: 'loading' | 'authed' | 'unauthed' = 'authed'

// Capture RootGate via the mocked createRootRoute so we can render it directly.
vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (opts: { component: () => ReactNode }) => ({ options: opts }),
  // Map `to`→href (so the anchor has the link role) and forward className/
  // aria-current (the tab-active signal) onto the node.
  Link: ({ children, to, ...rest }: { children: ReactNode; to?: string }) => (
    <a href={to ?? '#'} {...rest}>{children}</a>
  ),
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

describe('Bottom tab shell (Slice 1)', () => {
  it('authed user sees exactly the three people-first tabs (no old flat nav)', () => {
    sessionStatus = 'authed'
    mockPathname = '/'
    render(<RootGate />, { wrapper })
    const tabs = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(tabs).getByRole('link', { name: 'Members' })).toBeInTheDocument()
    expect(within(tabs).getByRole('link', { name: 'Events' })).toBeInTheDocument()
    expect(within(tabs).getByRole('link', { name: 'More' })).toBeInTheDocument()
    // Old flat top-nav labels are gone (low-frequency tools moved under More).
    expect(screen.queryByText('Roster')).not.toBeInTheDocument()
    expect(screen.queryByText('Payment settings')).not.toBeInTheDocument()
  })

  it('lights Members on / and on a /members deep route', () => {
    sessionStatus = 'authed'
    for (const path of ['/', '/members/m1/send']) {
      mockPathname = path
      const { unmount } = render(<RootGate />, { wrapper })
      expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Events' })).not.toHaveAttribute('aria-current')
      unmount()
    }
  })

  it('lights More on the low-frequency routes parked under it (e.g. /import)', () => {
    sessionStatus = 'authed'
    mockPathname = '/import'
    render(<RootGate />, { wrapper })
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Members' })).not.toHaveAttribute('aria-current')
  })

  it('renders no app chrome (no tabs) on the bare /sign-in page', () => {
    sessionStatus = 'unauthed'
    mockPathname = '/sign-in'
    render(<RootGate />, { wrapper })
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
  })
})
