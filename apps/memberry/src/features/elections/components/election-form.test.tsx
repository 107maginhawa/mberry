import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ElectionForm } from './election-form'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
// @monobase/ui rendered as real components against happy-dom.

import {
  createElectionMutation,
  updateElectionMutation,
} from '@monobase/sdk-ts/generated/react-query'
const mockCreateMutation = createElectionMutation as ReturnType<typeof vi.fn>
const mockUpdateMutation = updateElectionMutation as ReturnType<typeof vi.fn>

describe('ElectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
    mockUpdateMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  })

  test('renders step indicator with 3 steps', () => {
    renderWithProviders(<ElectionForm orgId="org-1" />)

    expect(screen.getByText('Basics')).toBeInTheDocument()
    expect(screen.getByText('Positions')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  test('renders basics step by default', () => {
    renderWithProviders(<ElectionForm orgId="org-1" />)

    expect(screen.getByLabelText('Election Title')).toBeInTheDocument()
    // Type buttons render lowercase text with CSS capitalize
    expect(screen.getByText('officer')).toBeInTheDocument()
    expect(screen.getByText('bylaw')).toBeInTheDocument()
  })

  test('renders voting mode options', () => {
    renderWithProviders(<ElectionForm orgId="org-1" />)

    expect(screen.getByText('online')).toBeInTheDocument()
    expect(screen.getByText('in-person')).toBeInTheDocument()
    expect(screen.getByText('hybrid')).toBeInTheDocument()
  })

  test('Next button is disabled when title is empty', () => {
    renderWithProviders(<ElectionForm orgId="org-1" />)

    expect(screen.getByText('Next')).toBeDisabled()
  })

  test('Next button enables when title is filled', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ElectionForm orgId="org-1" />)

    await user.type(screen.getByLabelText('Election Title'), '2025 Board Election')
    expect(screen.getByText('Next')).not.toBeDisabled()
  })

  test('navigates to positions step on Next', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ElectionForm orgId="org-1" />)

    await user.type(screen.getByLabelText('Election Title'), '2025 Election')
    await user.click(screen.getByText('Next'))

    // Now on Positions step - "Positions" appears in step indicator and content heading
    expect(screen.getByText('Add position')).toBeInTheDocument()
  })

  test('renders Cancel button', () => {
    const onCancel = vi.fn()
    renderWithProviders(<ElectionForm orgId="org-1" onCancel={onCancel} />)

    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('shows passage threshold input for bylaw type', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ElectionForm orgId="org-1" />)

    // Click the "bylaw" type button (rendered lowercase, CSS capitalize)
    await user.click(screen.getByText('bylaw'))

    expect(screen.getByLabelText('Passage Threshold (%)')).toBeInTheDocument()
  })

  test('hides passage threshold for officer type', () => {
    renderWithProviders(<ElectionForm orgId="org-1" />)

    expect(screen.queryByLabelText('Passage Threshold (%)')).not.toBeInTheDocument()
  })
})
