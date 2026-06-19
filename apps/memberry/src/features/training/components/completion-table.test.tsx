import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { CompletionTable } from './completion-table'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import {
  listCustomTrainingEnrollmentsOptions,
  completeCustomTrainingMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockListOptions = listCustomTrainingEnrollmentsOptions as ReturnType<typeof vi.fn>
const mockCompleteMutation = completeCustomTrainingMutation as ReturnType<typeof vi.fn>

function setupMutationMock() {
  mockCompleteMutation.mockReturnValue({
    mutationFn: vi.fn().mockResolvedValue({}),
  })
}

describe('CompletionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutationMock()
  })

  test('shows loading state', () => {
    mockListOptions.mockReturnValue({
      queryKey: ['training', 'enrollments', 'train-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(
      <CompletionTable orgId="org-1" trainingId="train-1" creditAmount="5" />,
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  test('shows empty state when no enrollments', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['training', 'enrollments', 'train-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(
      <CompletionTable orgId="org-1" trainingId="train-1" creditAmount="5" />,
    )

    await waitFor(() => {
      expect(
        screen.getByText('No enrollments yet. Enrollment data will appear here once members sign up.'),
      ).toBeInTheDocument()
    })
  })

  test('renders enrollment rows with status and completion', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['training', 'enrollments', 'train-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'enr-1',
              personId: 'person-1234abcd-long',
              status: 'enrolled',
              completedAt: null,
            },
            {
              id: 'enr-2',
              personId: 'person-5678efgh-long',
              status: 'enrolled',
              completedAt: '2025-03-15T10:00:00Z',
            },
          ],
          pagination: { totalCount: 2 },
        }),
    })

    renderWithProviders(
      <CompletionTable orgId="org-1" trainingId="train-1" creditAmount="5" />,
    )

    await waitFor(() => {
      // Truncated person IDs (first 8 chars + ellipsis)
      expect(screen.getByText('person-1…')).toBeInTheDocument()
      expect(screen.getByText('person-5…')).toBeInTheDocument()
    })

    // Status badges
    // 2 row status badges + the "Enrolled" summary-stat label = 3; assert both rows render
    expect(screen.getAllByText('Enrolled').length).toBeGreaterThanOrEqual(2)

    // Completion column: one pending, one completed
    expect(screen.getByText('Pending')).toBeInTheDocument()

    // Credits column: completed shows credits
    expect(screen.getByText('5 CPE')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()

    // Mark Complete button only for non-completed
    const markButtons = screen.getAllByText('Mark Complete')
    expect(markButtons).toHaveLength(1)
  })

  test('renders stat cards with enrollment count', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['training', 'enrollments', 'train-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'enr-1', personId: 'p1-abcdef00', status: 'enrolled', completedAt: '2025-03-15T10:00:00Z' },
          ],
          pagination: { totalCount: 1 },
        }),
    })

    renderWithProviders(
      <CompletionTable orgId="org-1" trainingId="train-1" creditAmount="3" />,
    )

    await waitFor(() => {
      expect(screen.getByText('Enrolled')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Credits Awarded')).toBeInTheDocument()
    })
  })
})
