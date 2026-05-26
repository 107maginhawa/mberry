import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'

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
  searchEventsOptions: () => ({
    queryKey: ['events'],
    queryFn: () => ({ data: [] }),
  }),
  listOrganizationsOptions: () => ({
    queryKey: ['organizations'],
    queryFn: () => ({ data: [] }),
  }),
  listCustomEventRegistrationsOptions: () => ({
    queryKey: ['registrations'],
    queryFn: () => ({ data: [] }),
  }),
}))

import '@/routes/events/index'

describe('Events Page', () => {
  test('renders Events heading for authorized user', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Events')).toBeInTheDocument()
  })

  test('denies access to analyst role', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})
