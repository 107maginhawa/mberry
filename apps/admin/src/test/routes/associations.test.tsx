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
  listAssociationsOptions: () => ({
    queryKey: ['associations'],
    queryFn: () => ({ data: [] }),
  }),
  listAssociationsQueryKey: () => ['associations'],
  createAssociationMutation: () => ({
    mutationFn: async () => ({}),
  }),
}))

import '@/routes/associations/index'

describe('Associations Page', () => {
  test('renders Associations heading', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Associations')).toBeInTheDocument()
  })

  test('renders Create Association button', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Create Association')).toBeInTheDocument()
  })

  test('renders table headers', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  test('renders stat cards', () => {
    const Page = getComponent()
    renderWithProviders(<Page />)
    expect(screen.getByText('Total Associations')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})
