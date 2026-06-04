import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DirectorySearch } from './directory-search'

// Mock SDK hooks
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import { searchDirectoryOptions } from '@monobase/sdk-ts/generated/react-query'
const mockSearchDirectory = searchDirectoryOptions as ReturnType<typeof vi.fn>

// @monobase/ui rendered as real components against happy-dom.

// Mock components
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: { headline: string; description: string; icon?: React.ReactNode }) => (
    <div data-testid="empty-state">
      <p>{headline}</p>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton">Loading...</div>,
}))

describe('DirectorySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders search input', () => {
    mockSearchDirectory.mockReturnValue({
      queryKey: ['directory', 'search'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DirectorySearch orgId="org-1" tenantId="tenant-1" />)
    expect(screen.getByPlaceholderText('Search members by name, specialty...')).toBeInTheDocument()
  })

  test('shows loading skeletons while fetching', () => {
    mockSearchDirectory.mockReturnValue({
      queryKey: ['directory', 'search'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<DirectorySearch orgId="org-1" tenantId="tenant-1" />)
    const skeletons = screen.getAllByTestId('card-skeleton')
    expect(skeletons).toHaveLength(6)
  })

  test('renders member cards with name and specialty', async () => {
    mockSearchDirectory.mockReturnValue({
      queryKey: ['directory', 'search'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'p-1',
              firstName: 'Maria',
              lastName: 'Santos',
              displayName: 'Maria Santos',
              title: 'DMD',
              specialty: 'Orthodontics',
              location: 'Manila, PH',
            },
            {
              id: 'p-2',
              firstName: 'Jose',
              lastName: 'Cruz',
              displayName: 'Jose Cruz',
              title: 'DDS',
              specialty: 'Periodontics',
            },
          ],
        }),
    })

    renderWithProviders(<DirectorySearch orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    })
    expect(screen.getByText('Jose Cruz')).toBeInTheDocument()
    expect(screen.getByText('DMD')).toBeInTheDocument()
    expect(screen.getByText('Orthodontics')).toBeInTheDocument()
    expect(screen.getByText('Periodontics')).toBeInTheDocument()
    expect(screen.getByText('Manila, PH')).toBeInTheDocument()
  })

  test('shows error state when search fails', async () => {
    mockSearchDirectory.mockReturnValue({
      queryKey: ['directory', 'search'],
      queryFn: () => Promise.reject(new Error('Server error')),
    })

    renderWithProviders(<DirectorySearch orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument()
    })
  })

  test('renders avatar initials when no photo URL', async () => {
    mockSearchDirectory.mockReturnValue({
      queryKey: ['directory', 'search'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'p-1', firstName: 'Maria', lastName: 'Santos', displayName: 'Maria Santos' },
          ],
        }),
    })

    renderWithProviders(<DirectorySearch orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('M')).toBeInTheDocument() // First letter of firstName
    })
  })

  test('renders empty results without empty-state when no search term', async () => {
    mockSearchDirectory.mockReturnValue({
      queryKey: ['directory', 'search'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DirectorySearch orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      // Empty state only shows when search is non-empty; with empty search, no "No members found"
      expect(screen.queryByText('No members found')).not.toBeInTheDocument()
    })
  })
})
