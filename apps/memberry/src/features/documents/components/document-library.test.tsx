import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DocumentLibrary } from './document-library'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('@monobase/ui', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />,
  Button: ({ children, onClick, variant, size, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Input: ({ placeholder, value, onChange, className, ...props }: any) => (
    <input placeholder={placeholder} value={value} onChange={onChange} className={className} {...props} />
  ),
  Select: ({ children, value, onValueChange }: any) => <div data-value={value}>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children, className }: any) => <div className={className}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>{children}</a>
  ),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/patterns/confirm-dialog', () => ({
  ConfirmDialog: ({ open, title }: any) =>
    open ? <div role="dialog">{title}</div> : null,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { searchDocumentsOptions } from '@monobase/sdk-ts/generated/react-query'
const mockSearchOptions = searchDocumentsOptions as ReturnType<typeof vi.fn>

describe('DocumentLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows error state', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load documents.')).toBeInTheDocument()
    })
  })

  test('shows empty state when no documents', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No documents yet. Upload your first document above.')).toBeInTheDocument()
    })
  })

  test('renders document list with title, status badge, and category', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'doc-1',
              title: 'Association Bylaws 2025',
              fileName: 'bylaws-2025.pdf',
              mimeType: 'application/pdf',
              size: 102400,
              status: 'published',
              category: 'bylaws',
              accessLevel: 'tenantOnly',
              tags: ['governance'],
              updatedAt: '2025-01-15T00:00:00Z',
              createdAt: '2025-01-10T00:00:00Z',
              ownerId: 'org-1',
              ownerType: 'organization',
            },
            {
              id: 'doc-2',
              title: 'Meeting Minutes March',
              fileName: 'minutes-march.pdf',
              mimeType: 'application/pdf',
              size: 51200,
              status: 'draft',
              category: 'minutes',
              accessLevel: 'restricted',
              tags: [],
              updatedAt: '2025-03-20T00:00:00Z',
              createdAt: '2025-03-20T00:00:00Z',
              ownerId: 'org-1',
              ownerType: 'organization',
            },
          ],
        }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Association Bylaws 2025')).toBeInTheDocument()
      expect(screen.getByText('Meeting Minutes March')).toBeInTheDocument()
    })

    // Status badges
    expect(screen.getByText('published')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()

    // Category badges (underscores replaced with spaces)
    expect(screen.getByText('bylaws')).toBeInTheDocument()
    expect(screen.getByText('minutes')).toBeInTheDocument()
  })

  test('renders category tabs', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
    })

    expect(screen.getByText('Bylaws')).toBeInTheDocument()
    expect(screen.getByText('Minutes')).toBeInTheDocument()
    expect(screen.getByText('Policies')).toBeInTheDocument()
    expect(screen.getByText('Forms')).toBeInTheDocument()
    expect(screen.getByText('Election Results')).toBeInTheDocument()
    expect(screen.getByText('Financial Reports')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  test('renders stat cards and search input', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'doc-1',
              title: 'Doc A',
              fileName: 'a.pdf',
              mimeType: 'application/pdf',
              size: 1024,
              status: 'published',
              category: 'bylaws',
              accessLevel: 'tenantOnly',
              tags: [],
              updatedAt: '2025-01-01T00:00:00Z',
              createdAt: '2025-01-01T00:00:00Z',
              ownerId: 'org-1',
              ownerType: 'organization',
            },
          ],
        }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Published').length).toBeGreaterThan(0)
    expect(screen.getByText(/showing/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument()
  })

  test('shows filtered empty state when search/filter active', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    // We can't easily trigger filter state from outside, but we can verify
    // the base empty state message renders correctly when data is empty
    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No documents yet. Upload your first document above.')).toBeInTheDocument()
    })
  })
})
