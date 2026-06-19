import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PollCard } from './poll-card'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock api so no actual fetches happen
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// Mock TanStack Query at the module level — return a fake poll by default
vi.mock('@tanstack/react-query', () => {
  const invalidateQueries = vi.fn()
  const useQueryClient = () => ({ invalidateQueries })

  const useQuery = vi.fn().mockReturnValue({
    data: {
      id: 'poll-1',
      title: 'Favourite dental tool?',
      options: [
        { label: 'Forceps', votes: 10 },
        { label: 'Scaler', votes: 5 },
      ],
      totalVotes: 15,
      hasVoted: false,
      selectedOption: undefined,
      status: 'active',
      deadline: null,
    },
    isLoading: false,
  })

  const mutate = vi.fn()
  const useMutation = vi.fn().mockReturnValue({
    mutate,
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
}))

// Mock lucide icons used in poll-card
vi.mock('lucide-react', () => ({
  BarChart3: () => <span data-testid="bar-chart-icon" />,
  CheckCircle2: () => <span data-testid="check-circle-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
}))

describe('PollCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[AC-PC-001] renders poll title', async () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    expect(await screen.findByText('Favourite dental tool?')).toBeInTheDocument()
  })

  test('[AC-PC-002] renders poll options as clickable buttons', async () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    expect(await screen.findByText('Forceps')).toBeInTheDocument()
    expect(screen.getByText('Scaler')).toBeInTheDocument()
  })

  test('[AC-PC-003] clicking an option selects it (Vote button appears)', async () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    await screen.findByText('Forceps')
    await userEvent.click(screen.getByText('Forceps'))
    expect(screen.getByText('Vote')).toBeInTheDocument()
  })

  test('[AC-PC-004] clicking Vote calls mutation with selected option (payload check)', async () => {
    const { useQuery, useMutation } = await import('@tanstack/react-query')
    const mutate = vi.fn()
    ;(useMutation as any).mockReturnValue({
      mutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    })

    renderWithProviders(<PollCard surveyId="poll-1" />)
    await screen.findByText('Forceps')
    await userEvent.click(screen.getByText('Forceps'))
    await userEvent.click(screen.getByText('Vote'))
    expect(mutate).toHaveBeenCalledWith('Forceps')
  })

  test('[AC-PC-005] shows vote count in footer', async () => {
    renderWithProviders(<PollCard surveyId="poll-1" />)
    expect(await screen.findByText('15 votes')).toBeInTheDocument()
  })

  test('[AC-PC-006] renders loading skeleton when isLoading=true', async () => {
    const { useQuery } = await import('@tanstack/react-query')
    ;(useQuery as any).mockReturnValue({ data: undefined, isLoading: true })
    renderWithProviders(<PollCard surveyId="poll-1" />)
    // Loading state has the animate-pulse class
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })
})
