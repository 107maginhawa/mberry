import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OfficerDashboard } from './officer-dashboard'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={String(to)}>{children}</a>
  ),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

// Mock session for greeting
vi.mock('@monobase/sdk-ts/react/hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { name: 'Jane Doe' } } }),
}))

// Mock SDK query options
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
// Mock motion/pattern components
vi.mock('@/components/patterns/skeleton-loader', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton">Loading...</div>,
}))

vi.mock('@/components/patterns/page-header', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/motion/count-up', () => ({
  CountUp: ({ value, suffix }: { value: number; suffix?: string }) => (
    <span>{value}{suffix ?? ''}</span>
  ),
}))

vi.mock('@/components/motion/stagger-grid', () => ({
  StaggerGrid: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '@/lib/api'
const mockApiGet = api.get as ReturnType<typeof vi.fn>

function setupApiResponses(overrides: {
  members?: any
  applications?: any
  dues?: any
} = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/membership/members/')) {
      return Promise.resolve(overrides.members ?? { data: [] })
    }
    if (url.includes('/membership/applications/')) {
      return Promise.resolve(overrides.applications ?? { data: [] })
    }
    if (url.includes('/dues/dashboard/')) {
      return Promise.resolve(overrides.dues ?? { data: { collectionRate: 85, upcomingActivities: 3 } })
    }
    return Promise.resolve({})
  })
}

describe('OfficerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders greeting with user name', () => {
    setupApiResponses()
    renderWithProviders(<OfficerDashboard orgId="org-1" />)
    expect(screen.getByText(/Good (morning|afternoon|evening), Jane/)).toBeInTheDocument()
  })

  test('shows loading skeletons while data fetches', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<OfficerDashboard orgId="org-1" />)
    const skeletons = screen.getAllByTestId('card-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('displays KPI values after loading', async () => {
    setupApiResponses({
      members: {
        data: [
          { status: 'active' },
          { status: 'active' },
          { status: 'gracePeriod' },
          { status: 'lapsed' },
        ],
      },
      dues: { data: { collectionRate: 72, upcomingActivities: 5 } },
    })

    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Active Members')).toBeInTheDocument()
    })

    // Metric values rendered via CountUp mock
    expect(screen.getByText('2')).toBeInTheDocument() // active
    expect(screen.getByText('72%')).toBeInTheDocument() // collection rate
  })

  test('shows "All clear" when no P0/P1 action items', async () => {
    setupApiResponses({
      members: { data: [{ status: 'active' }] },
      applications: { data: [] },
      dues: { data: { collectionRate: 85, upcomingActivities: 0 } },
    })

    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('All clear')).toBeInTheDocument()
    })
  })

  test('shows grace period action card when members are in grace', async () => {
    setupApiResponses({
      members: { data: [{ status: 'gracePeriod' }, { status: 'gracePeriod' }] },
      dues: { data: { collectionRate: 85, upcomingActivities: 0 } },
    })

    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/2 members in grace period/)).toBeInTheDocument()
    })
  })

  test('shows pending applications action card', async () => {
    setupApiResponses({
      members: { data: [{ status: 'active' }] },
      applications: { data: [{ id: '1' }, { id: '2' }, { id: '3' }] },
      dues: { data: { collectionRate: 85, upcomingActivities: 0 } },
    })

    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/3 pending applications/)).toBeInTheDocument()
    })
  })

  test('renders module summary cards', async () => {
    setupApiResponses({
      members: { data: [{ status: 'active' }] },
    })
    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    // Wait for queries to resolve and module cards to render
    await waitFor(() => {
      expect(screen.getAllByText('Members').length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('Finances').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Events').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Elections').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Documents').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Communications').length).toBeGreaterThan(0)
  })

  test('shows onboarding state for zero members', async () => {
    setupApiResponses({
      members: { data: [] },
      applications: { data: [] },
      dues: { data: { collectionRate: 0, upcomingActivities: 0 } },
    })

    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Get started with your association')).toBeInTheDocument()
    })

    expect(screen.getByText('Import Roster')).toBeInTheDocument()
    expect(screen.getByText('Add Member')).toBeInTheDocument()
  })
})
