import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OfficerManagement } from './officer-management'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// @monobase/ui rendered as real components against happy-dom.

// Mock motion/pattern components
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
  TableSkeleton: ({ rows }: { rows?: number }) => (
    <div data-testid="table-skeleton">Loading {rows ?? 3} rows...</div>
  ),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from '@/lib/api'
const mockApiGet = api.get as ReturnType<typeof vi.fn>

describe('OfficerManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeleton while fetching officers', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<OfficerManagement orgId="org-1" />)
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
  })

  test('shows empty state when no officers assigned', async () => {
    mockApiGet.mockResolvedValue({ data: [] })
    renderWithProviders(<OfficerManagement orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No officers assigned')).toBeInTheDocument()
    })
    expect(screen.getByText('Assign organization roles to get started.')).toBeInTheDocument()
  })

  test('shows officer count and Assign Role button after loading', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        { id: 'ot-1', status: 'active', position: { title: 'President' }, person: { name: 'Alice', email: 'alice@test.com' }, startDate: '2025-01-15' },
        { id: 'ot-2', status: 'active', position: { title: 'Treasurer' }, person: { name: 'Bob', email: 'bob@test.com' }, startDate: '2025-02-01' },
      ],
    })

    renderWithProviders(<OfficerManagement orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('2 officers assigned')).toBeInTheDocument()
    })
    expect(screen.getByText('Assign Role')).toBeInTheDocument()
  })

  test('renders officer names and roles in table', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        { id: 'ot-1', status: 'active', position: { title: 'President' }, person: { name: 'Alice Cruz', email: 'alice@test.com' }, startDate: '2025-01-15' },
      ],
    })

    renderWithProviders(<OfficerManagement orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('President')).toBeInTheDocument()
    })
    expect(screen.getByText('Alice Cruz')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
  })

  test('filters out inactive officer terms', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        { id: 'ot-1', status: 'active', position: { title: 'President' }, person: { name: 'Alice' }, startDate: '2025-01-15' },
        { id: 'ot-2', status: 'expired', position: { title: 'Secretary' }, person: { name: 'Bob' }, startDate: '2024-01-15' },
      ],
    })

    renderWithProviders(<OfficerManagement orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('President')).toBeInTheDocument()
    })
    expect(screen.queryByText('Secretary')).not.toBeInTheDocument()
    expect(screen.getByText('1 officer assigned')).toBeInTheDocument()
  })
})
