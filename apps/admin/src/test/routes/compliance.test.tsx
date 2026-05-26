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

import '@/routes/compliance/index'

describe('Compliance Page', () => {
  test('renders Compliance heading for authorized user', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Compliance')).toBeInTheDocument()
  })

  test('renders Coming Soon message', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    expect(
      screen.getByText('Compliance monitoring and reporting will be available in a future update.'),
    ).toBeInTheDocument()
  })

  test('renders page description', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(
      screen.getByText('Monitor regulatory compliance and reporting'),
    ).toBeInTheDocument()
  })

  test('allows analyst access', () => {
    const Page = getComponent()
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Compliance')).toBeInTheDocument()
  })
})
