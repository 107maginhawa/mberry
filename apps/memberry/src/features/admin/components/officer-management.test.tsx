import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OfficerManagement } from './officer-management'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock @monobase/ui
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} {...props} />
  ),
  Label: ({ children }: any) => <label>{children}</label>,
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  Table: ({ children, className }: any) => <table className={className}>{children}</table>,
  TableHeader: ({ children, className }: any) => <thead className={className}>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children, className }: any) => <tr className={className}>{children}</tr>,
  TableHead: ({ children, className }: any) => <th className={className}>{children}</th>,
  TableCell: ({ children, className, colSpan }: any) => <td className={className} colSpan={colSpan}>{children}</td>,
}))

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
