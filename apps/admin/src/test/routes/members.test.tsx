import { describe, test, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { routerMock, getComponent } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _captured: any = null
  return {
    routerMock: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createFileRoute: () => (opts: { component: any }) => {
        _captured = opts.component
        return { component: opts.component }
      },
      Link: () => null,
    },
    getComponent: () => _captured!,
  }
})

vi.mock('@tanstack/react-router', () => routerMock)

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  listOrganizationsOptions: () => ({
    queryKey: ['organizations'],
    queryFn: () => ({ data: [] }),
  }),
  listRosterMembersOptions: () => ({
    queryKey: ['roster'],
    queryFn: () => ({ data: [] }),
  }),
}))

vi.mock('@monobase/sdk-ts/generated/types.gen', () => ({}))

import '@/routes/members/index'

describe('Members Page', () => {
  test('renders Members heading', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Members')).toBeInTheDocument()
  })

  test('renders page description', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(
      screen.getByText('Search and manage platform members across all organizations'),
    ).toBeInTheDocument()
  })

  test('renders search input', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByPlaceholderText('Search by name, email...')).toBeInTheDocument()
  })

  test('renders table headers', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  test('shows empty state when no members', async () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    await waitFor(() => {
      expect(screen.getByText('No members found.')).toBeInTheDocument()
    })
  })
})
