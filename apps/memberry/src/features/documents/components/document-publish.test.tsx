import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { DocumentLibrary } from './document-library'

vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  searchDocumentsOptions: vi.fn(),
  searchDocumentsQueryKey: vi.fn(() => ['documents']),
  createDocumentMutation: vi.fn(() => ({})),
  archiveDocumentMutation: vi.fn(() => ({})),
  updateDocumentMutation: vi.fn(() => ({})),
  deleteDocumentMutation: vi.fn(() => ({})),
}))

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
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>{children}</a>
  ),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/patterns/confirm-dialog', () => ({
  ConfirmDialog: ({ open, title, onConfirm, onOpenChange }: any) =>
    open ? (
      <div role="dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={() => onOpenChange(false)}>Cancel</button>
      </div>
    ) : null,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { searchDocumentsOptions } from '@monobase/sdk-ts/generated/react-query'
const mockSearchOptions = searchDocumentsOptions as ReturnType<typeof vi.fn>

const draftDoc = {
  id: 'doc-draft',
  title: 'Draft Meeting Minutes',
  fileName: 'minutes-draft.pdf',
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
}

const publishedDoc = {
  id: 'doc-pub',
  title: 'Published Bylaws',
  fileName: 'bylaws.pdf',
  mimeType: 'application/pdf',
  size: 102400,
  status: 'published',
  category: 'bylaws',
  accessLevel: 'tenantOnly',
  tags: [],
  updatedAt: '2025-01-15T00:00:00Z',
  createdAt: '2025-01-10T00:00:00Z',
  ownerId: 'org-1',
  ownerType: 'organization',
}

describe('Document Publish Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Publish option visible in dropdown for draft documents', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [draftDoc] }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Draft Meeting Minutes')).toBeInTheDocument()
    })

    // Open the dropdown
    const actionsBtn = screen.getByRole('button', { name: /actions/i })
    await userEvent.click(actionsBtn)

    expect(screen.getByText('Publish')).toBeInTheDocument()
  })

  test('Publish option NOT visible for published documents', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [publishedDoc] }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Published Bylaws')).toBeInTheDocument()
    })

    // Open the dropdown
    const actionsBtn = screen.getByRole('button', { name: /actions/i })
    await userEvent.click(actionsBtn)

    expect(screen.queryByText('Publish')).not.toBeInTheDocument()
  })

  test('ConfirmDialog appears when Publish is clicked', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['documents', 'org-1'],
      queryFn: () => Promise.resolve({ data: [draftDoc] }),
    })

    renderWithProviders(<DocumentLibrary orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Draft Meeting Minutes')).toBeInTheDocument()
    })

    // Open dropdown and click Publish
    await userEvent.click(screen.getByRole('button', { name: /actions/i }))
    await userEvent.click(screen.getByText('Publish'))

    // ConfirmDialog should render
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Publish Document')).toBeInTheDocument()
  })
})
