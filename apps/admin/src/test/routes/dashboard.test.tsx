import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { routerMock, getComponent } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _captured: any = null
  return {
    routerMock: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createFileRoute: () => (opts: { component: any }) => {
        _captured = opts.component
        return { component: opts.component }
      },
      Link: () => null,
      redirect: () => {},
      Outlet: () => null,
      useParams: () => ({}),
    },
    getComponent: () => _captured!,
  }
})

vi.mock('@tanstack/react-router', () => routerMock)

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  listAssociationsOptions: () => ({ queryKey: ['associations'], queryFn: () => ({ data: [] }) }),
  listOrganizationsOptions: () => ({ queryKey: ['organizations'], queryFn: () => ({ data: [] }) }),
  listAdminsOptions: () => ({ queryKey: ['admins'], queryFn: () => [] }),
  listFeatureFlagsOptions: () => ({ queryKey: ['flags'], queryFn: () => ({ data: [] }) }),
  searchEventsOptions: () => ({ queryKey: ['events'], queryFn: () => ({ data: [] }) }),
  listAuditLogsOptions: () => ({ queryKey: ['auditLogs'], queryFn: () => ({ data: [] }) }),
}))

import '@/routes/index'

describe('Dashboard Page', () => {
  test('renders Platform Dashboard heading', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Platform Dashboard')).toBeInTheDocument()
  })

  test('renders Platform Health section with stat cards', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Platform Health')).toBeInTheDocument()
    expect(screen.getByText('Associations')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Active Events')).toBeInTheDocument()
    expect(screen.getByText('Operators')).toBeInTheDocument()
  })

  test('renders Refresh button', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })
})
