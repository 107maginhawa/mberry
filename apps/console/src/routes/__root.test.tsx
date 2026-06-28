import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

vi.mock('@/features/auth/use-session')
vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (opts: { component: React.ComponentType }) => opts,
  useNavigate: vi.fn(),
  useRouterState: vi.fn(),
  Outlet: () => <div>authed-tree</div>,
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
// Card is a styled wrapper — mock it to avoid any design-system side-effects in jsdom.
vi.mock('@monobase/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  AppHeader: ({ title }: { title: string }) => <header>{title}</header>,
}))

import { useSession } from '@/features/auth/use-session'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { RootGate } from './__root'

describe('RootGate auth guard', () => {
  const navigateMock = vi.fn()

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(navigateMock)
    navigateMock.mockReset()
  })

  it('unauthed @ / → navigate({ to: /sign-in }) AND protected Outlet NOT rendered', async () => {
    vi.mocked(useSession).mockReturnValue({ status: 'unauthed' })
    vi.mocked(useRouterState).mockReturnValue('/' as any)
    await act(async () => {
      render(<RootGate />)
    })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/sign-in' })
    expect(screen.queryByText('authed-tree')).toBeNull()
  })

  it('forbidden → "Platform operator access required" heading shown AND navigate NOT called', async () => {
    vi.mocked(useSession).mockReturnValue({ status: 'forbidden' })
    vi.mocked(useRouterState).mockReturnValue('/dashboard' as any)
    await act(async () => {
      render(<RootGate />)
    })
    expect(screen.getByText('Platform operator access required')).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('authed → Outlet rendered (sentinel visible)', async () => {
    vi.mocked(useSession).mockReturnValue({ status: 'authed' })
    vi.mocked(useRouterState).mockReturnValue('/dashboard' as any)
    await act(async () => {
      render(<RootGate />)
    })
    expect(screen.getByText('authed-tree')).toBeTruthy()
  })
})
