import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ElectionDetail } from './election-detail'

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  getElectionOptions: vi.fn(),
  listElectionsQueryKey: vi.fn(() => ['elections']),
  openElectionNominationsMutation: vi.fn(),
  openElectionVotingMutation: vi.fn(),
  certifyElectionMutation: vi.fn(),
  deleteCandidateMutation: vi.fn(),
}))

vi.mock('./nominee-picker-dialog', () => ({
  NomineePickerDialog: ({ onClose }: any) => (
    <div data-testid="nominee-picker-dialog">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: any) => {
    const href = to?.replace('$orgSlug', params?.orgSlug || '').replace('$electionId', params?.electionId || '')
    return <a href={href} className={className}>{children}</a>
  },
  useParams: () => ({ orgSlug: 'test-org' }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@monobase/ui', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />,
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

import {
  getElectionOptions,
  openElectionNominationsMutation,
  openElectionVotingMutation,
  certifyElectionMutation,
  deleteCandidateMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const mockGetElection = getElectionOptions as ReturnType<typeof vi.fn>
const mockNominations = openElectionNominationsMutation as ReturnType<typeof vi.fn>
const mockVoting = openElectionVotingMutation as ReturnType<typeof vi.fn>
const mockCertify = certifyElectionMutation as ReturnType<typeof vi.fn>
const mockDeleteCandidate = deleteCandidateMutation as ReturnType<typeof vi.fn>

function setupMutations() {
  mockNominations.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockVoting.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockCertify.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockDeleteCandidate.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
}

describe('ElectionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutations()
  })

  test('shows loading skeletons', () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows error state when query fails', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () => Promise.reject(new Error('Not found')),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load election')).toBeInTheDocument()
    })
  })

  test('renders election title and status', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () =>
        Promise.resolve({
          id: 'elec-1',
          title: '2025 Board Election',
          status: 'draft',
          type: 'officer',
          votingMode: 'online',
          positions: [],
          nominees: [],
          tallies: [],
        }),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('2025 Board Election')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0)
    expect(screen.getByText('officer')).toBeInTheDocument()
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  test('renders Open Nominations button for draft status', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () =>
        Promise.resolve({
          id: 'elec-1',
          title: '2025 Board Election',
          status: 'draft',
          type: 'officer',
          votingMode: 'online',
          positions: [],
          nominees: [],
          tallies: [],
        }),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Open Nominations')).toBeInTheDocument()
    })
  })

  test('renders positions with nominees', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () =>
        Promise.resolve({
            id: 'elec-1',
            title: 'Election',
            status: 'nominationsOpen',
            type: 'officer',
            votingMode: 'online',
            positions: [{ id: 'pos-1', title: 'President', sortOrder: 0 }],
            nominees: [
              { id: 'nom-1', positionId: 'pos-1', personId: 'person-abc123', status: 'nominated' },
            ],
            tallies: [],
        }),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('President')).toBeInTheDocument()
    })

    expect(screen.getByText('1 nominee')).toBeInTheDocument()
    expect(screen.getByText('person-abc123')).toBeInTheDocument()
    expect(screen.getByText('nominated')).toBeInTheDocument()
  })

  test('shows empty positions state', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () =>
        Promise.resolve({
            id: 'elec-1',
            title: 'Election',
            status: 'draft',
            type: 'officer',
            votingMode: 'online',
            positions: [],
            nominees: [],
            tallies: [],
        }),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No positions defined yet')).toBeInTheDocument()
    })
  })

  test('shows published confirmation banner', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () =>
        Promise.resolve({
            id: 'elec-1',
            title: 'Election',
            status: 'published',
            type: 'officer',
            votingMode: 'online',
            publishedAt: '2025-06-20T10:00:00Z',
            positions: [],
            nominees: [],
            tallies: [],
        }),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Results published on/)).toBeInTheDocument()
    })
  })

  test('renders timeline dates section', async () => {
    mockGetElection.mockReturnValue({
      queryKey: ['election', 'elec-1'],
      queryFn: () =>
        Promise.resolve({
            id: 'elec-1',
            title: 'Election',
            status: 'draft',
            type: 'officer',
            votingMode: 'online',
            nominationStart: '2025-06-01T00:00:00Z',
            nominationEnd: '2025-06-10T00:00:00Z',
            votingStart: '2025-06-15T00:00:00Z',
            votingEnd: '2025-06-20T00:00:00Z',
            positions: [],
            nominees: [],
            tallies: [],
        }),
    })

    renderWithProviders(<ElectionDetail electionId="elec-1" orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Nominations Open').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Nominations Close/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Voting Open/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Voting Close/i).length).toBeGreaterThan(0)
    })
  })
})
