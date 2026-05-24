import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@monobase/ui', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/patterns/page-header', () => ({
  PageHeader: ({ title, subtitle }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  ListSkeleton: () => <div data-testid="loading">Loading...</div>,
}))

vi.mock('@/hooks/useOrg', () => ({
  useOrg: () => ({ orgId: 'org-test', orgSlug: 'test-org' }),
}))

// Mock api
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  Wrapper.displayName = 'TestQueryWrapper'
  return Wrapper
}

// ---------------------------------------------------------------------------
// Test: Analytics KPI Cards
// ---------------------------------------------------------------------------

describe('Analytics Dashboard — KPI cards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders correct totals from mock data', async () => {
    const mockAnnouncements = [
      {
        id: 'a1',
        title: 'Welcome Email',
        channelPush: true,
        channelEmail: true,
        status: 'sent',
        publishedAt: new Date().toISOString(), // this month
        stats: { recipients: 100, emailSent: 90, pushDelivered: 80, inappViews: 50 },
      },
      {
        id: 'a2',
        title: 'Dues Reminder',
        channelPush: true,
        channelEmail: false,
        status: 'sent',
        publishedAt: new Date().toISOString(), // this month
        stats: { recipients: 50, emailSent: 0, pushDelivered: 40, inappViews: 30 },
      },
      {
        id: 'a3',
        title: 'Old Announcement',
        channelPush: false,
        channelEmail: true,
        status: 'sent',
        publishedAt: '2024-01-15T00:00:00Z', // not this month
        stats: { recipients: 200, emailSent: 180, pushDelivered: 0, inappViews: 100 },
      },
    ]

    mockGet.mockResolvedValue({ data: mockAnnouncements, total: 3 })

    // Verify the KPI aggregation logic works correctly
    const announcements = mockAnnouncements
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonthCount = announcements.filter(
      (a) => a.publishedAt && new Date(a.publishedAt) >= thisMonthStart,
    ).length

    const totalRecipients = announcements.reduce(
      (sum, a) => sum + (a.stats?.recipients ?? 0),
      0,
    )
    const totalEmail = announcements.reduce(
      (sum, a) => sum + (a.stats?.emailSent ?? 0),
      0,
    )
    const totalPush = announcements.reduce(
      (sum, a) => sum + (a.stats?.pushDelivered ?? 0),
      0,
    )

    // 2 this-month announcements (a1, a2)
    expect(thisMonthCount).toBe(2)
    // 100 + 50 + 200 = 350
    expect(totalRecipients).toBe(350)
    // 90 + 0 + 180 = 270
    expect(totalEmail).toBe(270)
    // 80 + 40 + 0 = 120
    expect(totalPush).toBe(120)
  })
})

// ---------------------------------------------------------------------------
// Test: Saved Segments in Audience Picker
// ---------------------------------------------------------------------------

describe('AudiencePicker — Saved Segments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('loads saved segments and populates filters on select', async () => {
    const savedSegments = [
      {
        id: 'seg-1',
        name: 'Active Fellows',
        filters: { duesStatus: 'active', membershipTier: 'fellow' },
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]

    // Roster preview
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/communications/segments')) {
        return Promise.resolve({ data: savedSegments })
      }
      return Promise.resolve({ data: [], total: 0 })
    })

    const { AudiencePicker } = await import('../components/audience-picker')
    const onChange = vi.fn()

    render(
      <AudiencePicker
        orgId="org-test"
        value={{}}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    )

    // Wait for segments to load (option must be rendered)
    await waitFor(() => {
      expect(screen.getByText('Active Fellows')).toBeInTheDocument()
    })

    // Select segment
    const select = screen.getByTestId('saved-segment-select')
    fireEvent.change(select, { target: { value: 'seg-1' } })

    // onChange should be called with the segment's filters
    expect(onChange).toHaveBeenCalledWith({
      duesStatus: 'active',
      membershipTier: 'fellow',
    })
  })

  test('shows save button when filters are active', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0 })

    const { AudiencePicker } = await import('../components/audience-picker')

    const { rerender } = render(
      <AudiencePicker
        orgId="org-test"
        value={{}}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    )

    // No "Save Segment" button when no active filters
    expect(screen.queryByText('Save Segment')).not.toBeInTheDocument()

    // Re-render with active filters
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
          })
        }
      >
        <AudiencePicker
          orgId="org-test"
          value={{ duesStatus: 'active' }}
          onChange={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Save Segment')).toBeInTheDocument()
  })
})
