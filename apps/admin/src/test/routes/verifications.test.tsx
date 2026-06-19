/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { Route } from '@/routes/verifications/index'

const Page = Route.options.component as any

describe('Verifications Page', () => {
  test('renders Verifications heading for super admin', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Verifications')).toBeInTheDocument()
  })

  test('renders page description', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('Review and manage member credential verifications'),
    ).toBeInTheDocument()
  })

  test('allows support role access', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Verifications')).toBeInTheDocument()
  })

  test('denies analyst role access', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('renders Coming Soon placeholder content', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    expect(
      screen.getByText('Credential verification management will be available in a future update.'),
    ).toBeInTheDocument()
  })
})
