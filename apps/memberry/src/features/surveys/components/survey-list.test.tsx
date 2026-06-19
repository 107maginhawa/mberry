import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { SurveyList } from './survey-list'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/hooks/use-org', () => ({
  useOrg: vi.fn().mockReturnValue({ orgId: 'org-1', orgSlug: 'test-org' }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className, onClick }: any) => (
    <a className={className} onClick={onClick}>{children}</a>
  ),
  useParams: vi.fn().mockReturnValue({ orgSlug: 'test-org' }),
}))

const mockMutate = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  QueryClient: class {
    defaultOptions = {}
  },
  QueryClientProvider: ({ children }: any) => children,
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
}))

describe('SurveyList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[AC-SL-001] shows "No surveys yet" empty state heading', () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('No surveys yet')).toBeInTheDocument()
  })

  test('[AC-SL-002] shows empty state helper text about creating first survey', () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getByText('Create your first survey to gather member feedback')).toBeInTheDocument()
  })

  test('[AC-SL-003] renders tab filters (All, Draft, Active, Closed)', () => {
    renderWithProviders(<SurveyList />)
    expect(screen.getAllByText(/^All/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/^Draft/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/^Active/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/^Closed/).length).toBeGreaterThanOrEqual(1)
  })
})
