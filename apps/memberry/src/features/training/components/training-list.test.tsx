import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TrainingList } from './training-list'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: any) => {
    const href = to?.replace('$orgSlug', params?.orgSlug || '').replace('$trainingId', params?.trainingId || '')
    return <a href={href} className={className}>{children}</a>
  },
  useNavigate: () => vi.fn(),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

vi.mock('@/components/patterns/confirm-dialog', () => ({
  ConfirmDialog: ({ children, onConfirm, title }: any) => (
    <div data-testid="confirm-dialog"><span>{title}</span><button onClick={onConfirm}>Confirm</button>{children}</div>
  ),
}))

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} {...props} />
  ),
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children, className }: any) => <div className={className}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  searchTrainingsOptions: vi.fn(),
  searchTrainingsQueryKey: vi.fn(() => ['trainings']),
  cancelCustomTrainingMutation: vi.fn(),
}))

import {
  searchTrainingsOptions,
  cancelCustomTrainingMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const mockSearchOptions = searchTrainingsOptions as ReturnType<typeof vi.fn>
const mockCancelMutation = cancelCustomTrainingMutation as ReturnType<typeof vi.fn>

function setupMocks() {
  mockCancelMutation.mockReturnValue({
    mutationFn: vi.fn().mockResolvedValue({}),
  })
}

describe('TrainingList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  test('shows loading skeleton', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['trainings', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<TrainingList orgId="org-1" />)

    // Skeleton pulse elements
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state with create link', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['trainings', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<TrainingList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No trainings found.')).toBeInTheDocument()
    })

    const createLink = screen.getByText('Create one')
    expect(createLink.closest('a')).toHaveAttribute('href', '/org/test-org/officer/training/new')
  })

  test('renders training cards when data exists', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['trainings', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'train-1',
              title: 'Dental Seminar',
              type: 'seminar',
              status: 'published',
              creditAmount: '5',
              startDate: '2025-06-15T09:00:00Z',
              enrollmentCount: 10,
            },
          ],
          pagination: { totalCount: 1 },
        }),
    })

    renderWithProviders(<TrainingList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dental Seminar')).toBeInTheDocument()
    })

    expect(screen.getByText('1 total')).toBeInTheDocument()
  })

  test('renders tab buttons', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['trainings', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<TrainingList orgId="org-1" />)

    expect(screen.getByText('Upcoming')).toBeInTheDocument()
    expect(screen.getByText('Past')).toBeInTheDocument()
    // "Drafts" appears in both tab and stat card
    expect(screen.getAllByText('Drafts')).toHaveLength(2)
  })

  test('renders stat cards', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['trainings', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<TrainingList orgId="org-1" />)

    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Enrollments')).toBeInTheDocument()
    expect(screen.getByText('CPE Credits Offered')).toBeInTheDocument()
  })

  test('renders search input and type filter', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['trainings', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<TrainingList orgId="org-1" />)

    expect(screen.getByPlaceholderText('Search trainings...')).toBeInTheDocument()
    // "All Types" appears in SelectValue placeholder and SelectItem — use getAllByText
    expect(screen.getAllByText('All Types').length).toBeGreaterThanOrEqual(1)
  })
})
