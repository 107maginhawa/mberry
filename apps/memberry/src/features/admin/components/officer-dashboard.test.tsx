import { describe, test, expect, vi, beforeEach } from 'vitest'
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

  test('renders page header', () => {
    setupApiResponses()
    renderWithProviders(<OfficerDashboard orgId="org-1" />)
    expect(screen.getByText('Officer Dashboard')).toBeInTheDocument()
  })

  test('shows loading skeletons while data fetches', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<OfficerDashboard orgId="org-1" />)
    const skeletons = screen.getAllByTestId('card-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('displays metric values after loading', async () => {
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
    expect(screen.getByText('5')).toBeInTheDocument() // upcoming activities
  })

  test('shows "All clear" when no action items needed', async () => {
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
      members: { data: [] },
      applications: { data: [{ id: '1' }, { id: '2' }, { id: '3' }] },
      dues: { data: { collectionRate: 85, upcomingActivities: 0 } },
    })

    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/3 pending applications/)).toBeInTheDocument()
    })
  })

  test('renders quick links section', async () => {
    setupApiResponses()
    renderWithProviders(<OfficerDashboard orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Quick Links')).toBeInTheDocument()
    })

    expect(screen.getByText('Roster')).toBeInTheDocument()
    expect(screen.getByText('Applications')).toBeInTheDocument()
    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })
})
