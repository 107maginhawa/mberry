/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  renderWithProviders,
  MOCK_SUPER_ADMIN,
  MOCK_SUPPORT_ADMIN,
  MOCK_ANALYST_ADMIN,
} from '@/test/utils'
// listAdminsOptions and revokeAdminMutation are global jest.fn() stubs
// (test-setup-root.ts). We prime their return values per-test.
import {
  listAdminsOptions,
  revokeAdminMutation,
} from '@monobase/sdk-ts/generated/react-query'

// sdk.gen mock needed so the route module can import it without errors.
mock.module('@monobase/sdk-ts/generated/sdk.gen', () => ({
  revokeAdmin: async () => ({ data: { ok: true } }),
  inviteAdmin: async () => ({ data: { ok: true } }),
}))

// Import the Route AFTER the sdk.gen mock is registered.
const { Route } = await import('@/routes/operators/index')
const Page = Route.options.component as any

const TWO_ADMINS = [
  { id: 'a1', name: 'Ada Lovelace', email: 'ada@x.com', role: 'support', lastActiveAt: null },
  { id: 'a2', name: 'Grace Hopper', email: 'grace@x.com', role: 'analyst', lastActiveAt: null },
]

function primeAdmins(admins: typeof TWO_ADMINS | []) {
  ;(listAdminsOptions as any).mockImplementation(() => ({
    queryKey: ['listAdmins'],
    queryFn: async () => admins,
  }))
}

describe('Operators Page — role gate', () => {
  beforeEach(() => primeAdmins([]))

  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  test('denies access to support role (operators is super-only)', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPPORT_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})

describe('Operators Page — data rendering', () => {
  test('renders operator rows for super admin', async () => {
    primeAdmins(TWO_ADMINS)
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })
    expect(screen.getByText('ada@x.com')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('grace@x.com')).toBeInTheDocument()
  })

  test('renders empty state when no admins', async () => {
    primeAdmins([])
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    await waitFor(() => {
      expect(screen.getByText('No operators found.')).toBeInTheDocument()
    })
  })
})

describe('Operators Page — revoke flow', () => {
  beforeEach(() => {
    primeAdmins(TWO_ADMINS)
  })

  test('revoke is two-step: click trash shows confirm buttons', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })

    // Click the trash button for the first admin row
    const revokeButtons = screen.getAllByRole('button', { name: /revoke access/i })
    await user.click(revokeButtons[0]!)

    // Confirm UI appears
    expect(screen.getByText('Revoke?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /no/i })).toBeInTheDocument()
  })

  test('clicking Yes calls revoke mutationFn with correct adminId', async () => {
    const revokeSpy = mock(async (_args: any) => ({ data: { ok: true } }))
    ;(revokeAdminMutation as any).mockImplementation(() => ({
      mutationFn: revokeSpy,
    }))

    const user = userEvent.setup()
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })

    const revokeButtons = screen.getAllByRole('button', { name: /revoke access/i })
    await user.click(revokeButtons[0]!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /yes/i }))

    await waitFor(() => {
      expect(revokeSpy).toHaveBeenCalled()
    })
    const call = revokeSpy.mock.calls[0]![0]
    expect(call.path.adminId).toBe('a1')
  })
})
