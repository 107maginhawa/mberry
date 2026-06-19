import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { SurveyList } from './survey-list'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/hooks/use-org', () => ({
  useOrg: () => ({ orgId: 'org-1', orgSlug: 'test-org', org: null, isLoading: false }),
}))

vi.mock('@tanstack/react-query', () => {
  const invalidateQueries = vi.fn()
  const useQueryClient = () => ({ invalidateQueries })

  const useQuery = vi.fn().mockReturnValue({
    data: [
      {
        id: 's-1',
        title: 'Member Satisfaction Survey',
        surveyType: 'satisfaction',
        status: 'active',
        anonymous: false,
        deadline: null,
        responseCount: 12,
        questionCount: 5,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 's-2',
        title: 'Annual NPS',
        surveyType: 'nps',
        status: 'draft',
        anonymous: true,
        deadline: null,
        responseCount: 0,
        questionCount: 2,
        createdAt: '2026-06-10T00:00:00.000Z',
      },
    ],
    isLoading: false,
    error: null,
  })

  const useMutation = vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  })

  return { useQuery, useMutation, useQueryClient }
})

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, variant, size, disabled, className, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...rest}>{children}</button>
  ),
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  Tabs: ({ children, value, onValueChange }: any) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button role="tab" data-value={value}>{children}</button>,
  MenuItem: ({ children, onClick, destructive, className }: any) => (
    <button onClick={onClick} className={className} data-destructive={destructive}>{children}</button>
  ),
}))

// lucide icons used in survey-list
vi.mock('lucide-react', () => ({
  ClipboardList: () => <span data-testid="clipboard-icon" />,
  BarChart3: () => <span />,
  Clock: () => <span />,
  FileText: () => <span />,
  Send: () => <span />,
  Lock: () => <span />,
  Trash2: () => <span />,
  ChevronRight: () => <span />,
  MoreHorizontal: () => <span />,
  Users: () => <span />,
  Copy: () => <span />,
}))

describe('SurveyList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[AC-SL-001] renders survey titles from query data', async () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('Member Satisfaction Survey')).toBeInTheDocument()
    expect(screen.getByText('Annual NPS')).toBeInTheDocument()
  })

  test('[AC-SL-002] shows response count per survey', () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('12 responses')).toBeInTheDocument()
    expect(screen.getByText('0 responses')).toBeInTheDocument()
  })

  test('[AC-SL-003] shows empty state when no surveys', async () => {
    const { useQuery } = await import('@tanstack/react-query')
    ;(useQuery as any).mockReturnValueOnce({
      data: [],
      isLoading: false,
      error: null,
    })
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('No surveys yet')).toBeInTheDocument()
    expect(screen.getByText(/Create your first survey/)).toBeInTheDocument()
  })

  test('[AC-SL-004] shows loading skeletons when isLoading=true', async () => {
    const { useQuery } = await import('@tanstack/react-query')
    ;(useQuery as any).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      error: null,
    })
    renderWithProviders(<SurveyList />)
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  test('[AC-SL-005] shows error message on fetch failure', async () => {
    const { useQuery } = await import('@tanstack/react-query')
    ;(useQuery as any).mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    })
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('Failed to load surveys')).toBeInTheDocument()
  })

  test('[AC-SL-006] renders stats row with Total, Active, Drafts, Closed', () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    // "Active" appears in both the stats row and as a status badge; use getAllByText
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Drafts')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })

  test('[AC-SL-007] shows question count per survey', () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('5 questions')).toBeInTheDocument()
    expect(screen.getByText('2 questions')).toBeInTheDocument()
  })
})
