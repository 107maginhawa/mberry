/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { Route } from '@/routes/compliance/index'

const Page = Route.options.component as any

describe('Compliance Page', () => {
  test('renders Compliance heading for authorized user', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Compliance')).toBeInTheDocument()
  })

  test('renders Coming Soon message', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    expect(
      screen.getByText('Compliance monitoring and reporting will be available in a future update.'),
    ).toBeInTheDocument()
  })

  test('renders page description', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('Monitor regulatory compliance and reporting'),
    ).toBeInTheDocument()
  })

  test('allows support role access', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Compliance')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })

  test('allows analyst access', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Compliance')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })
})
