import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ElectionList } from './election-list'

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  listElectionsOptions: vi.fn(),
}))

vi.mock('@monobase/ui', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={to?.replace('$orgSlug', params?.orgSlug).replace('$electionId', params?.electionId)} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

import { listElectionsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
const mockListOptions = listElectionsOptions as ReturnType<typeof vi.fn>

describe('ElectionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons', () => {
    mockListOptions.mockReturnValue({
      queryKey: ['elections', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<ElectionList orgId="org-1" />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows error state', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['elections', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<ElectionList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load elections')).toBeInTheDocument()
    })
  })

  test('shows empty state', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['elections', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<ElectionList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No elections yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first election to get started')).toBeInTheDocument()
    })
  })

  test('renders election list items with title and badges', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['elections', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'elec-1',
              title: '2025 Board Election',
              status: 'votingOpen',
              type: 'officer',
              votingOpenAt: '2025-06-15T00:00:00Z',
              positions: [{ id: 'p1' }, { id: 'p2' }],
            },
            {
              id: 'elec-2',
              title: 'Bylaw Amendment Vote',
              status: 'draft',
              type: 'bylaw',
              passageThreshold: 67,
              positions: [],
            },
          ],
        }),
    })

    renderWithProviders(<ElectionList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('2025 Board Election')).toBeInTheDocument()
      expect(screen.getByText('Bylaw Amendment Vote')).toBeInTheDocument()
    })

    // Status badges
    expect(screen.getByText('Voting Open')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()

    // Type badges
    expect(screen.getByText('Officer')).toBeInTheDocument()
    expect(screen.getByText('Bylaw')).toBeInTheDocument()

    // Position count
    expect(screen.getByText('2 positions')).toBeInTheDocument()

    // Threshold for bylaw
    expect(screen.getByText('67% threshold')).toBeInTheDocument()
  })

  test('renders stat cards', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['elections', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'e1', title: 'A', status: 'votingOpen', type: 'officer', positions: [] },
            { id: 'e2', title: 'B', status: 'draft', type: 'officer', positions: [] },
            { id: 'e3', title: 'C', status: 'published', type: 'officer', positions: [] },
          ],
        }),
    })

    renderWithProviders(<ElectionList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Drafts')).toBeInTheDocument()
      expect(screen.getByText('Published')).toBeInTheDocument()
    })
  })
})
