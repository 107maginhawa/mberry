import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DocumentBrowser } from './document-browser'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
// Router (Link, useParams) provided by global mock in test-setup-root.ts.
// @monobase/ui rendered as real components against happy-dom.

import { searchDocumentsOptions } from '@monobase/sdk-ts/generated/react-query'
const mockSearchOptions = searchDocumentsOptions as ReturnType<typeof vi.fn>

const makeDoc = (overrides: Partial<{
  id: string
  title: string
  fileName: string
  mimeType: string
  size: number
  accessLevel: string
  category: string
  tags: string[]
  updatedAt: string
  createdAt: string
}> = {}) => ({
  id: 'doc-1',
  title: 'Sample Document',
  fileName: 'sample.pdf',
  mimeType: 'application/pdf',
  size: 102400,
  accessLevel: 'tenantOnly',
  category: 'bylaws',
  tags: [],
  updatedAt: '2025-06-01T00:00:00Z',
  createdAt: '2025-06-01T00:00:00Z',
  ...overrides,
})

describe('DocumentBrowser', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
  })

  test('shows loading skeletons', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state when no documents', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No documents available')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Documents will appear here when published by your organization.'),
    ).toBeInTheDocument()
  })

  test('shows error state', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load documents/)).toBeInTheDocument()
    })
  })

  test('renders documents filtered to member access levels (public + tenantOnly)', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            makeDoc({ id: 'doc-1', title: 'Public Doc', accessLevel: 'public', category: 'bylaws' }),
            makeDoc({ id: 'doc-2', title: 'Members Only Doc', accessLevel: 'tenantOnly', category: 'minutes' }),
            makeDoc({ id: 'doc-3', title: 'Officers Only Doc', accessLevel: 'restricted', category: 'policies' }),
            makeDoc({ id: 'doc-4', title: 'Privileged Doc', accessLevel: 'privileged', category: 'other' }),
          ],
        }),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Public Doc')).toBeInTheDocument()
      expect(screen.getByText('Members Only Doc')).toBeInTheDocument()
    })

    // Officers-only and privileged docs must NOT appear
    expect(screen.queryByText('Officers Only Doc')).not.toBeInTheDocument()
    expect(screen.queryByText('Privileged Doc')).not.toBeInTheDocument()
  })

  test('renders category tabs for all categories', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/All/)).toBeInTheDocument()
    })

    expect(screen.getByText(/Bylaws/)).toBeInTheDocument()
    expect(screen.getByText(/Minutes/)).toBeInTheDocument()
    expect(screen.getByText(/Policies/)).toBeInTheDocument()
    expect(screen.getByText(/Forms/)).toBeInTheDocument()
    expect(screen.getByText(/Election Results/)).toBeInTheDocument()
    expect(screen.getByText(/Financial Reports/)).toBeInTheDocument()
    expect(screen.getByText(/Other/)).toBeInTheDocument()
  })

  test('renders search input', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    expect(screen.getByPlaceholderText('Search documents by title or tag...')).toBeInTheDocument()
  })

  test('renders document title and category badge', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            makeDoc({
              id: 'doc-1',
              title: 'Association Bylaws 2025',
              accessLevel: 'tenantOnly',
              category: 'bylaws',
            }),
          ],
        }),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Association Bylaws 2025')).toBeInTheDocument()
    })

    expect(screen.getByText('Bylaws')).toBeInTheDocument()
  })

  test('shows Public badge for public-access documents', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            makeDoc({ id: 'doc-1', title: 'Open Policy', accessLevel: 'public', category: 'policies' }),
          ],
        }),
    })

    renderWithProviders(<DocumentBrowser orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Open Policy')).toBeInTheDocument()
    })

    expect(screen.getByText('Public')).toBeInTheDocument()
  })
})
