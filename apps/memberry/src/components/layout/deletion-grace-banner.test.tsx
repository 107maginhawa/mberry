import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DeletionGraceBanner } from './deletion-grace-banner'

// FIX-010 (G-09 / AC-M02-003): a pending account-deletion must surface an
// app-wide grace banner with a Cancel CTA — not only inside Settings → General.
// The banner reads `deletionScheduledAt` off getPerson('me') and cancels via
// the cancelMyAccountDeletion mutation. SDK hooks are globally stubbed in
// test-setup-root.ts; we drive them here per-test.
import {
  getPersonOptions,
  getPersonQueryKey,
  cancelMyAccountDeletionMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockGetPersonOptions = getPersonOptions as ReturnType<typeof vi.fn>
const mockGetPersonQueryKey = getPersonQueryKey as ReturnType<typeof vi.fn>
const mockCancelMutation = cancelMyAccountDeletionMutation as ReturnType<typeof vi.fn>

function primePerson(person: Record<string, unknown>) {
  mockGetPersonOptions.mockReturnValue({
    queryKey: ['get-person', 'me'],
    queryFn: () => Promise.resolve(person),
  })
}

const FUTURE = new Date(Date.now() + 20 * 86400000).toISOString()

describe('DeletionGraceBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPersonQueryKey.mockReturnValue(['get-person', { path: { person: 'me' } }])
    mockCancelMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  })

  test('renders nothing when no deletion is scheduled', async () => {
    primePerson({ id: 'p1', deletionScheduledAt: null })

    renderWithProviders(<DeletionGraceBanner />)

    // Let the person query resolve, then confirm the banner is absent.
    await waitFor(() => expect(mockGetPersonOptions).toHaveBeenCalled())
    expect(screen.queryByTestId('deletion-grace-banner')).toBeNull()
  })

  test('renders a warning banner with a Cancel deletion CTA during grace', async () => {
    primePerson({ id: 'p1', deletionScheduledAt: FUTURE })

    renderWithProviders(<DeletionGraceBanner />)

    const banner = await screen.findByTestId('deletion-grace-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/scheduled for deletion/i)
    expect(
      screen.getByRole('button', { name: /cancel deletion/i }),
    ).toBeInTheDocument()
  })

  test('clicking Cancel deletion fires the cancel mutation', async () => {
    const mutationFn = vi.fn().mockResolvedValue({})
    mockCancelMutation.mockReturnValue({ mutationFn })
    primePerson({ id: 'p1', deletionScheduledAt: FUTURE })

    renderWithProviders(<DeletionGraceBanner />)

    const cancelBtn = await screen.findByRole('button', { name: /cancel deletion/i })
    fireEvent.click(cancelBtn)

    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1))
  })
})
