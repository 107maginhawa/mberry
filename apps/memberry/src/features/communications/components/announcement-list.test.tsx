import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { AnnouncementList } from './announcement-list'

// Mock @monobase/ui
vi.mock('@monobase/ui', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  Input: ({ value, onChange, placeholder, className }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} />
  ),
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: any) => <a href={String(to)} {...rest}>{children}</a>,
  useParams: () => ({ orgSlug: 'test-org' }),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '@/lib/api'
const mockApiGet = api.get as ReturnType<typeof vi.fn>

describe('AnnouncementList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons while fetching', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<AnnouncementList orgId="org-1" />)
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state when no announcements', async () => {
    mockApiGet.mockResolvedValue({ data: [], meta: { total: 0 } })
    renderWithProviders(<AnnouncementList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No announcements yet. Send your first message to members.')).toBeInTheDocument()
    })
  })

  test('renders announcement titles and status badges', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('status=sent&pageSize=1')) {
        return Promise.resolve({ meta: { total: 5 } })
      }
      return Promise.resolve({
        data: [
          {
            id: 'ann-1',
            title: 'Annual Meeting Notice',
            audienceType: 'all',
            channelPush: true,
            channelEmail: false,
            status: 'sent',
            publishedAt: '2025-03-15T00:00:00Z',
          },
          {
            id: 'ann-2',
            title: 'CPD Reminder',
            audienceType: 'by_category',
            channelPush: false,
            channelEmail: true,
            status: 'draft',
            createdAt: '2025-04-01T00:00:00Z',
          },
        ],
        meta: { total: 2 },
      })
    })

    renderWithProviders(<AnnouncementList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Annual Meeting Notice')).toBeInTheDocument()
    })
    expect(screen.getByText('CPD Reminder')).toBeInTheDocument()
    // "Sent" appears in both tab and badge — use getAllByText
    const sentElements = screen.getAllByText('Sent')
    expect(sentElements.length).toBeGreaterThanOrEqual(2) // tab + badge
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  test('renders status filter tabs', async () => {
    mockApiGet.mockResolvedValue({ data: [], meta: { total: 0 } })
    renderWithProviders(<AnnouncementList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
    })
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
    expect(screen.getByText('Drafts')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  test('renders search input', async () => {
    mockApiGet.mockResolvedValue({ data: [], meta: { total: 0 } })
    renderWithProviders(<AnnouncementList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search announcements...')).toBeInTheDocument()
    })
  })

  test('renders stat cards with totals', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('status=sent&pageSize=1')) {
        return Promise.resolve({ meta: { total: 12 } })
      }
      return Promise.resolve({ data: [], meta: { total: 25 } })
    })

    renderWithProviders(<AnnouncementList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeInTheDocument()
    })
    // Stats may resolve at different times; wait for the sent count
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
    })
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  test('shows audience and channel info per announcement', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('pageSize=1')) return Promise.resolve({ meta: { total: 0 } })
      return Promise.resolve({
        data: [
          {
            id: 'ann-1',
            title: 'Test Announcement',
            audienceType: 'all',
            channelPush: true,
            channelEmail: true,
            status: 'sent',
            publishedAt: '2025-03-15T00:00:00Z',
          },
        ],
        meta: { total: 1 },
      })
    })

    renderWithProviders(<AnnouncementList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/All members/)).toBeInTheDocument()
    })
  })
})
