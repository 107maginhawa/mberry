import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_SUPPORT_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'

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
  listFeatureFlagsOptions: () => ({
    queryKey: ['flags'],
    queryFn: () => ({ data: [] }),
  }),
  listFeatureFlagsQueryKey: () => ['flags'],
  setFeatureFlagMutation: () => ({
    mutationFn: async () => ({}),
  }),
  deleteFeatureFlagMutation: () => ({
    mutationFn: async () => ({}),
  }),
}))

import '@/routes/feature-flags/index'

describe('Feature Flags Page', () => {
  test('renders Feature Flags heading for super admin', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Feature Flags')).toBeInTheDocument()
  })

  test('denies access to support role', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('renders Create Flag button for super admin', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Create Flag')).toBeInTheDocument()
  })
})
