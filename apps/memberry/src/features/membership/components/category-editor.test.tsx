import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { CategoryEditor } from './category-editor'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock SDK generated hooks
vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  listMembershipCategoriesOptions: vi.fn(),
  listMembershipCategoriesQueryKey: vi.fn(() => ['categories']),
  upsertMembershipCategoryMutation: vi.fn(),
}))

import {
  listMembershipCategoriesOptions,
  upsertMembershipCategoryMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockListMembershipCategoriesOptions = listMembershipCategoriesOptions as ReturnType<typeof vi.fn>
const mockUpsertMembershipCategoryMutation = upsertMembershipCategoryMutation as ReturnType<typeof vi.fn>

function setupMutationMocks() {
  mockUpsertMembershipCategoryMutation.mockReturnValue({
    mutationFn: vi.fn().mockResolvedValue({}),
  })
}

describe('CategoryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutationMocks()
  })

  test('shows loading skeletons while categories are loading', () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => new Promise(() => {}), // never resolves
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    // Skeleton elements rendered during loading
    const skeletons = document.querySelectorAll('.space-y-3 > *')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  test('shows error state when query fails', async () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load categories.')).toBeInTheDocument()
    })
  })

  test('shows empty state when no categories', async () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No categories yet. Create one to get started.')).toBeInTheDocument()
    })
  })

  test('renders category rows with name, dues amount, and status', async () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'cat-1',
              name: 'Regular Member',
              description: 'Standard membership',
              duesAmount: 250000, // P2,500.00
              billingCycle: 'annual',
              memberCount: 45,
              active: true,
            },
            {
              id: 'cat-2',
              name: 'Associate',
              description: 'Associate membership',
              duesAmount: 100000, // P1,000.00
              billingCycle: 'quarterly',
              memberCount: 12,
              active: false,
            },
          ],
        }),
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Regular Member')).toBeInTheDocument()
    })

    expect(screen.getByText('Associate')).toBeInTheDocument()

    // Dues formatted
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    expect(screen.getByText('₱1,000.00')).toBeInTheDocument()

    // Status badges
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  test('shows Deactivate button only for active categories', async () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'cat-1', name: 'Regular', duesAmount: 250000, billingCycle: 'annual', active: true },
            { id: 'cat-2', name: 'Associate', duesAmount: 100000, billingCycle: 'annual', active: false },
          ],
        }),
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Regular')).toBeInTheDocument()
    })

    // Only one Deactivate button (for the active category)
    const deactivateButtons = screen.getAllByText('Deactivate')
    expect(deactivateButtons).toHaveLength(1)
  })

  test('renders Add Category button', async () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Add Category')).toBeInTheDocument()
    })
  })

  test('renders table headers when categories exist', async () => {
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [{ id: 'cat-1', name: 'Regular', duesAmount: 250000, billingCycle: 'annual', active: true }],
        }),
    })

    renderWithProviders(<CategoryEditor orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument()
    })

    expect(screen.getByText('Dues')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })
})
