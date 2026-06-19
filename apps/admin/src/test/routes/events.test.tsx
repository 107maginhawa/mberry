/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { searchEventsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Route } from '@/routes/events/index'

const Page = Route.options.component as any

describe('Events Page', () => {
  test('renders Events heading for authorized user', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Events')).toBeInTheDocument()
  })

  test('allows support role access', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('renders event title from primed query data', async () => {
    ;(searchEventsOptions as any).mockImplementation(() => ({
      queryKey: ['searchEvents'],
      queryFn: async () => ({
        data: [
          {
            id: 'ev1',
            title: 'Annual Dental Congress',
            status: 'published',
            startDate: '2026-09-01',
            organizationName: 'PDA',
          },
        ],
        pagination: { totalCount: 1 },
      }),
    }))
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    await waitFor(() => {
      expect(screen.getByText('Annual Dental Congress')).toBeInTheDocument()
    })
  })
})
