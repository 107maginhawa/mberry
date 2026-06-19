/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import {
  renderWithProviders,
  MOCK_SUPER_ADMIN,
  MOCK_SUPPORT_ADMIN,
  MOCK_ANALYST_ADMIN,
} from '@/test/utils'
import { Route } from '@/routes/communications/moderation'

const Page = Route.options.component as any

describe('Moderation Queue Page — role gate', () => {
  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('allows super admin access', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Moderation Queue')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })

  test('allows support role access', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Moderation Queue')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })
})

describe('Moderation Queue Page — content', () => {
  test('renders page subtitle', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('Review reported content across all organizations'),
    ).toBeInTheDocument()
  })

  test('renders filter tab buttons', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
  })
})
