import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { AffiliationList } from './affiliation-list'

// Mock the SDK generated hooks
vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  listChapterAffiliationsOptions: vi.fn(),
}))

import { listChapterAffiliationsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const mockListChapterAffiliationsOptions = listChapterAffiliationsOptions as ReturnType<typeof vi.fn>

describe('AffiliationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading state while fetching', () => {
    mockListChapterAffiliationsOptions.mockReturnValue({
      queryKey: ['chapters', 'affiliations'],
      queryFn: () => new Promise(() => {}), // never resolves
    })

    renderWithProviders(<AffiliationList orgId="org-1" tenantId="tenant-1" />)

    expect(screen.getByText('Loading affiliations...')).toBeInTheDocument()
  })

  test('shows error state when query fails', async () => {
    mockListChapterAffiliationsOptions.mockReturnValue({
      queryKey: ['chapters', 'affiliations'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<AffiliationList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load affiliations')).toBeInTheDocument()
    })
  })

  test('shows empty state when no affiliations', async () => {
    mockListChapterAffiliationsOptions.mockReturnValue({
      queryKey: ['chapters', 'affiliations'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<AffiliationList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('No chapter affiliations.')).toBeInTheDocument()
    })
  })

  test('renders affiliation rows with member, chapter, primary, status, joined', async () => {
    mockListChapterAffiliationsOptions.mockReturnValue({
      queryKey: ['chapters', 'affiliations'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'aff-1',
              personId: 'person-123',
              chapterId: 'chapter-abc',
              isPrimary: true,
              status: 'active',
              affiliatedAt: '2024-06-15',
            },
            {
              id: 'aff-2',
              personId: 'person-456',
              chapterId: 'chapter-def',
              isPrimary: false,
              status: 'inactive',
              affiliatedAt: '2023-01-10',
            },
          ],
        }),
    })

    renderWithProviders(<AffiliationList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('person-123')).toBeInTheDocument()
      expect(screen.getByText('chapter-abc')).toBeInTheDocument()
    })

    // Table headers
    expect(screen.getByText('Member')).toBeInTheDocument()
    expect(screen.getByText('Chapter')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Joined')).toBeInTheDocument()

    // Row data
    expect(screen.getByText('person-456')).toBeInTheDocument()
    expect(screen.getByText('chapter-def')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('inactive')).toBeInTheDocument()

    // isPrimary display
    const yesCells = screen.getAllByText('Yes')
    const noCells = screen.getAllByText('No')
    expect(yesCells.length).toBe(1)
    expect(noCells.length).toBe(1)
  })

  test('passes tenantId as x-org-id header to SDK options', () => {
    mockListChapterAffiliationsOptions.mockReturnValue({
      queryKey: ['chapters', 'affiliations'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<AffiliationList orgId="org-1" tenantId="tenant-42" />)

    expect(mockListChapterAffiliationsOptions).toHaveBeenCalledWith({
      headers: { 'x-org-id': 'tenant-42' },
    })
  })
})
