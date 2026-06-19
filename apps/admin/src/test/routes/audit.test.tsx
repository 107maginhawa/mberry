/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { listAuditLogsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Route } from '@/routes/audit/index'

const Page = Route.options.component as any

describe('Audit Page', () => {
  test('renders Audit Log heading for super admin', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Audit Log')).toBeInTheDocument()
  })

  test('renders page description', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('View and filter audit events across all modules'),
    ).toBeInTheDocument()
  })

  test('allows support role access', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Audit Log')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument()
  })

  test('renders audit log rows from primed query data', async () => {
    ;(listAuditLogsOptions as any).mockImplementation(() => ({
      queryKey: ['listAuditLogs'],
      queryFn: async () => ({
        data: [
          {
            id: 'log1',
            action: 'create',
            resourceType: 'membership',
            resource: 'mbr-001',
            user: 'ada@x.com',
            createdAt: '2026-06-19T10:00:00Z',
          },
        ],
        pagination: { totalCount: 1 },
      }),
    }))
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    await waitFor(() => {
      expect(screen.getByText('create')).toBeInTheDocument()
    })
    expect(screen.getByText('membership')).toBeInTheDocument()
    expect(screen.getByText('ada@x.com')).toBeInTheDocument()
  })
})
