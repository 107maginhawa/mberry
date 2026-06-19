import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PollCard } from './poll-card'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const mockMutate = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  QueryClient: class {
    defaultOptions = {}
  },
  QueryClientProvider: ({ children }: any) => children,
  useQuery: vi.fn().mockReturnValue({
    data: {
      id: 'poll-1',
      title: 'What is your preferred meeting time?',
      options: [
        { label: 'Morning', votes: 10 },
        { label: 'Afternoon', votes: 5 },
        { label: 'Evening', votes: 2 },
      ],
      totalVotes: 17,
      deadline: null,
      hasVoted: false,
      selectedOption: undefined,
      status: 'active',
    },
    isLoading: false,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: mockInvalidate,
  }),
}))

describe('PollCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[AC-PC-001] renders poll question title', () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    expect(screen.getByText('What is your preferred meeting time?')).toBeInTheDocument()
  })

  test('[AC-PC-002] renders all poll options', () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    expect(screen.getByText('Morning')).toBeInTheDocument()
    expect(screen.getByText('Afternoon')).toBeInTheDocument()
    expect(screen.getByText('Evening')).toBeInTheDocument()
  })

  test('[AC-PC-003] renders total vote count', () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    expect(screen.getByText(/17 votes/)).toBeInTheDocument()
  })
})
