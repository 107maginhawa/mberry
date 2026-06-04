import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { VotingBallot } from './voting-ballot'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('@monobase/sdk-ts/generated/sdk.gen', () => ({
  castBallot: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}))

// Router (useNavigate, useParams) provided by global mock in test-setup-root.ts.
// @monobase/ui rendered as real components against happy-dom.

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { getElectionOptions } from '@monobase/sdk-ts/generated/react-query'
import { castBallot } from '@monobase/sdk-ts/generated/sdk.gen'
import { api } from '@/lib/api'

const mockGetElectionOptions = getElectionOptions as ReturnType<typeof vi.fn>
const mockCastBallot = castBallot as ReturnType<typeof vi.fn>
const mockApi = api as { get: ReturnType<typeof vi.fn> }

const ELECTION_DATA = {
  data: {
    title: '2025 Board Election',
    status: 'votingOpen',
    positions: [
      { id: 'pos-1', title: 'President', sortOrder: 1 },
      { id: 'pos-2', title: 'Secretary', sortOrder: 2 },
    ],
    nominees: [
      { id: 'nom-1', personId: 'person-alice', personName: 'Alice Smith', positionId: 'pos-1', status: 'accepted' },
      { id: 'nom-2', personId: 'person-bob', personName: 'Bob Jones', positionId: 'pos-2', status: 'accepted' },
    ],
  },
}

describe('VotingBallot — confirm dialog', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
    mockGetElectionOptions.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () => Promise.resolve(ELECTION_DATA),
    })
    mockApi.get.mockResolvedValue({ data: [] })
  })

  async function renderAndSelectAll() {
    renderWithProviders(
      <VotingBallot electionId="elec-1" orgId="org-1" userId="user-1" />,
    )
    await waitFor(() => {
      expect(screen.getByText('2025 Board Election')).toBeInTheDocument()
    })
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[0])
    fireEvent.click(radios[1])
  }

  test('confirm dialog appears on submit click', async () => {
    await renderAndSelectAll()
    const submitBtn = screen.getByRole('button', { name: /review & submit/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('Confirm Your Ballot')).toBeInTheDocument()
    })
  })

  test('dialog shows position selections with candidate names', async () => {
    await renderAndSelectAll()
    fireEvent.click(screen.getByRole('button', { name: /review & submit/i }))
    await waitFor(() => {
      expect(screen.getByText('Confirm Your Ballot')).toBeInTheDocument()
    })
    // Candidate names + positions appear in both ballot and dialog
    expect(screen.getAllByText(/President/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Alice Smith/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Secretary/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Bob Jones/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/cannot be changed/)).toBeInTheDocument()
  })

  test('cancel closes dialog without voting', async () => {
    await renderAndSelectAll()
    fireEvent.click(screen.getByRole('button', { name: /review & submit/i }))
    await waitFor(() => {
      expect(screen.getByText('Confirm Your Ballot')).toBeInTheDocument()
    })
    // Click cancel in dialog
    const cancelBtns = screen.getAllByRole('button', { name: /cancel/i })
    const dialogCancel = cancelBtns[cancelBtns.length - 1]
    fireEvent.click(dialogCancel)
    await waitFor(() => {
      expect(screen.queryByText('Confirm Your Ballot')).not.toBeInTheDocument()
    })
    expect(mockCastBallot).not.toHaveBeenCalled()
  })

  test('confirm button calls castBallot for each position', async () => {
    mockCastBallot.mockResolvedValue({})
    await renderAndSelectAll()
    fireEvent.click(screen.getByRole('button', { name: /review & submit/i }))
    await waitFor(() => {
      expect(screen.getByText('Confirm Your Ballot')).toBeInTheDocument()
    })
    // Click the Submit Ballot button in the dialog
    const submitBtns = screen.getAllByRole('button', { name: /submit ballot/i })
    fireEvent.click(submitBtns[0])
    await waitFor(() => {
      expect(mockCastBallot).toHaveBeenCalledTimes(2)
    })
    expect(mockCastBallot).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ positionId: 'pos-1', candidateId: 'nom-1' }),
      }),
    )
  })
})
