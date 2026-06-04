/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { Route } from '@/routes/feature-flags/index'

const Page = Route.options.component as any

describe('Feature Flags Page', () => {
  test('renders Feature Flags heading for super admin', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Feature Flags')).toBeInTheDocument()
  })

  test('denies access to support role', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('renders Create Flag button for super admin', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Create Flag')).toBeInTheDocument()
  })
})
