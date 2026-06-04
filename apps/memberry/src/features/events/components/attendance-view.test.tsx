import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { AttendanceView } from './attendance-view'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
// @monobase/ui rendered as real components against happy-dom.

import {
  listCustomEventAttendanceOptions,
  checkInCustomEventMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockListOptions = listCustomEventAttendanceOptions as ReturnType<typeof vi.fn>
const mockCheckInMutation = checkInCustomEventMutation as ReturnType<typeof vi.fn>

function setupMutationMock() {
  mockCheckInMutation.mockReturnValue({
    mutationFn: vi.fn().mockResolvedValue({}),
  })
}

describe('AttendanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutationMock()
  })

  test('shows loading skeletons', () => {
    mockListOptions.mockReturnValue({
      queryKey: ['event', 'attendance', 'evt-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<AttendanceView eventId="evt-1" />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state when no check-ins', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['event', 'attendance', 'evt-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { total: 0, qr: 0, manual: 0 } }),
    })

    renderWithProviders(<AttendanceView eventId="evt-1" />)

    await waitFor(() => {
      expect(screen.getByText('No check-ins yet.')).toBeInTheDocument()
    })
  })

  test('renders attendance records with person ID and method', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['event', 'attendance', 'evt-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'att-1', personId: 'person-abc', checkedInAt: '2025-06-15T09:30:00Z', method: 'qr' },
            { id: 'att-2', personId: 'person-def', checkedInAt: '2025-06-15T10:00:00Z', method: 'manual' },
          ],
          pagination: { total: 2, qr: 1, manual: 1 },
        }),
    })

    renderWithProviders(<AttendanceView eventId="evt-1" />)

    await waitFor(() => {
      expect(screen.getByText('person-abc')).toBeInTheDocument()
      expect(screen.getByText('person-def')).toBeInTheDocument()
    })

    expect(screen.getByText('QR')).toBeInTheDocument()
    // "Manual" appears in both the check-in section and the attendance badge
    expect(screen.getAllByText('Manual').length).toBeGreaterThanOrEqual(1)
  })

  test('renders stat cards', async () => {
    mockListOptions.mockReturnValue({
      queryKey: ['event', 'attendance', 'evt-1'],
      queryFn: () =>
        Promise.resolve({
          data: [],
          pagination: { total: 5, qr: 3, manual: 2 },
        }),
    })

    renderWithProviders(<AttendanceView eventId="evt-1" />)

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('QR Scan')).toBeInTheDocument()
    })
  })

  test('renders manual check-in form', () => {
    mockListOptions.mockReturnValue({
      queryKey: ['event', 'attendance', 'evt-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<AttendanceView eventId="evt-1" />)

    expect(screen.getByText('Manual Check-in')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter member ID...')).toBeInTheDocument()
    expect(screen.getByText('Check In')).toBeInTheDocument()
  })
})
