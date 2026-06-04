/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
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

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument()
  })
})
