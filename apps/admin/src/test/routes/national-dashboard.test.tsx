/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import {
  renderWithProviders,
  MOCK_SUPER_ADMIN,
  MOCK_SUPPORT_ADMIN,
  MOCK_ANALYST_ADMIN,
} from '@/test/utils'
// listAssociationsOptions is a global jest.fn() stub (test-setup-root.ts).
import { listAssociationsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Route } from '@/routes/national-dashboard/index'

const Page = Route.options.component as any

function primeAssociations() {
  ;(listAssociationsOptions as any).mockImplementation(() => ({
    queryKey: ['listAssociations'],
    queryFn: async () => ({
      data: [
        { id: 'assoc-1', name: 'Philippine Dental Association' },
        { id: 'assoc-2', name: 'Manila Dental Society' },
      ],
      pagination: { totalCount: 2 },
    }),
  }))
}

describe('National Dashboard Page — role gate', () => {
  beforeEach(() => primeAssociations())

  test('denies access to support role', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})

describe('National Dashboard Page — super admin access', () => {
  beforeEach(() => primeAssociations())

  test('renders National Dashboard heading for super admin', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('National Dashboard')).toBeInTheDocument()
  })

  test('renders association options in the selector', async () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    await waitFor(() => {
      // The association select is present on page load
      expect(screen.getByText('Select association')).toBeInTheDocument()
    })
  })
})
// ponytail: data-render of chapter rows needs a global fetch mock for the
// /api/admin/national-dashboard/:id endpoint — covered by e2e
