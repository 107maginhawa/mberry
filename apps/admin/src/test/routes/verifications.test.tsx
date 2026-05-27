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

import '@/routes/verifications/index'

describe('Verifications Page', () => {
  test('renders Verifications heading for super admin', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Verifications')).toBeInTheDocument()
  })

  test('renders page description', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('Review and manage member credential verifications'),
    ).toBeInTheDocument()
  })

  test('allows support role access', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Verifications')).toBeInTheDocument()
  })

  test('denies analyst role access', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})
