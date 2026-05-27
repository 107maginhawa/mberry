import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'

const { routerMock, getComponent } = vi.hoisted(() => {
  let _captured: any = null
  return {
    routerMock: {
      createFileRoute: () => (opts: { component: any }) => {
        _captured = opts.component
        return { component: opts.component }
      },
    },
    getComponent: () => _captured!,
  }
})

vi.mock('@tanstack/react-router', () => routerMock)

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  listAuditLogsOptions: () => ({
    queryKey: ['auditLogs'],
    queryFn: () => ({ data: [], pagination: { totalCount: 0 } }),
  }),
}))

vi.mock('@monobase/sdk-ts/generated/types.gen', () => ({}))

import '@/routes/audit/index'

describe('Audit Page', () => {
  test('renders Audit Log heading for super admin', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Audit Log')).toBeInTheDocument()
  })

  test('renders page description', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('View and filter audit events across all modules'),
    ).toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument()
  })
})
