/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { Route } from '@/routes/events/index'

const Page = Route.options.component as any

describe('Events Page', () => {
  test('renders Events heading for authorized user', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Events')).toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})
