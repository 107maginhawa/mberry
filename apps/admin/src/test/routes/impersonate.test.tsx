/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  renderWithProviders,
  MOCK_SUPER_ADMIN,
  MOCK_SUPPORT_ADMIN,
  MOCK_ANALYST_ADMIN,
} from '@/test/utils'
// listPersonsOptions is a global jest.fn() stub (test-setup-root.ts). We prime
// its return value per-test rather than re-mocking the whole module.
import { listPersonsOptions } from '@monobase/sdk-ts/generated/react-query'

// ─── FIX-010 (G3): impersonate member search must use a real person-search
// endpoint (listPersons) — the old picker read `org.members` off
// listOrganizations, which never returns members, so the search was always
// empty. These tests prove the picker queries listPersons with the typed query
// and renders selectable targets keyed by the real person id.

const startImpersonationSpy = mock(async (_args: any) => ({
  data: { sessionId: 's1', targetUserId: 'person-1', startedAt: new Date().toISOString() },
}))

mock.module('@monobase/sdk-ts/generated/sdk.gen', () => ({
  startImpersonation: (args: any) => startImpersonationSpy(args),
  endImpersonation: async () => ({ data: { ok: true } }),
}))

// Import the route AFTER the sdk.gen mock is registered.
const { Route } = await import('@/routes/impersonate/index')
const Page = Route.options.component as any

let lastListPersonsQuery: Record<string, unknown> | undefined

function primePersonSearch() {
  lastListPersonsQuery = undefined
  ;(listPersonsOptions as any).mockImplementation((opts?: { query?: Record<string, unknown> }) => {
    lastListPersonsQuery = opts?.query
    return {
      queryKey: ['listPersons', opts?.query ?? {}],
      queryFn: async () => ({
        data: [
          { id: 'person-1', firstName: 'Ada', lastName: 'Lovelace', contactInfo: { email: 'ada@example.com' } },
          { id: 'person-2', firstName: 'Grace', lastName: 'Hopper', contactInfo: { email: 'grace@example.com' } },
        ],
        pagination: { offset: 0, limit: 25, total: 2 },
      }),
    }
  })
}

describe('Impersonate Page (FIX-007 — UI role gate)', () => {
  beforeEach(() => primePersonSearch())

  test('renders for super admin', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Impersonate User')).toBeInTheDocument()
  })

  test('renders for support admin (super + support are entitled)', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Impersonate User')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })

  test('denies access to analyst (read-only tier)', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})

describe('Impersonate Page (FIX-010 — member search uses listPersons)', () => {
  beforeEach(() => primePersonSearch())

  test('typing a query searches persons and renders selectable targets', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })

    const input = screen.getByPlaceholderText(/search for a user/i)
    await user.type(input, 'ada')

    // The picker must surface persons returned by listPersons, not org.members.
    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()

    // And it must forward the typed query to the person-search endpoint.
    expect(lastListPersonsQuery).toBeDefined()
    expect(String((lastListPersonsQuery as any).q)).toBe('ada')
  })

  test('clicking Impersonate starts a session for the selected person id', async () => {
    startImpersonationSpy.mockClear()
    const user = userEvent.setup()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })

    const input = screen.getByPlaceholderText(/search for a user/i)
    await user.type(input, 'ada')

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })

    // Click Ada's row (the first person in the result set → person-1). The
    // page-level "Impersonate User" heading is not a button, so the row action
    // buttons are exactly the per-result actions.
    const adaRow = screen.getByText('Ada Lovelace').closest('tr')!
    const adaButton = within(adaRow).getByRole('button', { name: /impersonate/i })
    await user.click(adaButton)

    await waitFor(() => {
      expect(startImpersonationSpy).toHaveBeenCalled()
    })
    const call = startImpersonationSpy.mock.calls[0]![0]
    expect(call.body.targetUserId).toBe('person-1')
  })
})
