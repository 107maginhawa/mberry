import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { DataExport } from './data-export'

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

// Mock motion/glass-card
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

// Mock patterns/empty-state
vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline }: any) => <div>{headline}</div>,
}))

import { api } from '@/lib/api'
import { toast } from 'sonner'

const mockApiGet = api.get as ReturnType<typeof vi.fn>

describe('DataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  test('renders without crash', () => {
    renderWithProviders(<DataExport />)

    expect(screen.getByText("What's included in your export")).toBeInTheDocument()
    expect(screen.getByText('Request Data Export')).toBeInTheDocument()
  })

  test('shows explanation text about export contents', () => {
    renderWithProviders(<DataExport />)

    expect(
      screen.getByText(/Your export includes all personal data we hold about you/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Exports are available for 7 days after generation/)
    ).toBeInTheDocument()
  })

  test('request button is enabled when not rate limited', () => {
    renderWithProviders(<DataExport />)

    const button = screen.getByRole('button', { name: /Request Data Export/i })
    expect(button).not.toBeDisabled()
  })

  test('request button is disabled when rate limited', () => {
    // Set a recent request timestamp
    localStorage.setItem('data_export_last_request', new Date().toISOString())

    renderWithProviders(<DataExport />)

    const button = screen.getByRole('button', { name: /Next export available/i })
    expect(button).toBeDisabled()
    expect(screen.getByText(/You requested an export recently/)).toBeInTheDocument()
  })

  test('shows export table after successful request', async () => {
    const user = userEvent.setup()
    mockApiGet.mockResolvedValue({ categories: ['profile', 'membership'] })

    renderWithProviders(<DataExport />)

    const button = screen.getByRole('button', { name: /Request Data Export/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Previous Exports')).toBeInTheDocument()
      expect(screen.getByText('Ready')).toBeInTheDocument()
      expect(screen.getByText('Download')).toBeInTheDocument()
    })

    expect(toast.success).toHaveBeenCalledWith('Export ready', expect.any(Object))
  })

  test('shows error toast on failed request', async () => {
    const user = userEvent.setup()
    mockApiGet.mockRejectedValue(new Error('Network error'))

    renderWithProviders(<DataExport />)

    const button = screen.getByRole('button', { name: /Request Data Export/i })
    await user.click(button)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Export failed', expect.any(Object))
    })
  })

  test('does not show previous exports table initially', () => {
    renderWithProviders(<DataExport />)

    expect(screen.queryByText('Previous Exports')).not.toBeInTheDocument()
  })
})
