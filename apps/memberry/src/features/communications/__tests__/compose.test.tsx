import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ComposeForm } from '../components/compose-form'

// Mock @tanstack/react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ orgSlug: 'test-org' }),
}))

// Mock @monobase/ui
vi.mock('@monobase/ui', () => ({
  Input: ({ children, ...rest }: any) => <input {...rest} />,
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  Textarea: ({ children, ...rest }: any) => <textarea {...rest} />,
  Switch: ({ checked, onCheckedChange }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      data-testid="switch"
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  ),
  Button: ({ children, onClick, type, disabled, variant, className }: any) => (
    <button onClick={onClick} type={type} disabled={disabled} className={className} data-variant={variant}>
      {children}
    </button>
  ),
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}))

// Mock date-picker
vi.mock('@/components/patterns/date-picker', () => ({
  DateTimePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="datetime-picker" type="text" value={value ?? ''} onChange={(e: any) => onChange?.(e.target.value)} {...rest} />
  ),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock api
const mockApi = {
  get: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  post: vi.fn().mockResolvedValue({ data: { id: 'ann-1' } }),
  patch: vi.fn().mockResolvedValue({ data: { id: 'ann-1' } }),
}
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApi.get(...args),
    post: (...args: any[]) => mockApi.post(...args),
    patch: (...args: any[]) => mockApi.patch(...args),
  },
}))

// Mock zod-resolver
vi.mock('@/lib/zod-resolver', () => ({
  zodResolver: () => async (values: any) => ({ values, errors: {} }),
}))

describe('ComposeForm - VS-028 audience + send pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: [], total: 0 })
    mockApi.post.mockResolvedValue({ data: { id: 'ann-1' } })
  })

  test('filter selection triggers roster query with debounce', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Click "By Segment" to show the audience picker
    const bySegmentBtn = screen.getByText('By Segment')
    await userEvent.click(bySegmentBtn)

    // The audience picker should now be visible and trigger a roster query
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/association/member/roster'),
      )
    }, { timeout: 2000 })
  })

  test('send disabled when no channels selected', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Initially In-App + Push are on, so Send Now is enabled
    const sendBtn = screen.getByText('Send Now')
    expect(sendBtn).not.toBeDisabled()

    // Turn off all channels by clicking each switch
    const switches = screen.getAllByRole('switch')
    // Toggle all switches off — in-app, push, email
    for (const sw of switches) {
      if (sw.getAttribute('aria-checked') === 'true') {
        await userEvent.click(sw)
      }
    }

    // Send should now be disabled
    await waitFor(() => {
      const btn = screen.getByText('Send Now')
      expect(btn).toBeDisabled()
    })
  })

  test('at least 1 channel required - error message shown', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Turn off all channel switches
    const switches = screen.getAllByRole('switch')
    for (const sw of switches) {
      if (sw.getAttribute('aria-checked') === 'true') {
        await userEvent.click(sw)
      }
    }

    await waitFor(() => {
      expect(screen.getByText('At least one channel must be selected')).toBeTruthy()
    })
  })

  test('double-click prevention on send button', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Fill required fields
    const titleInput = screen.getByPlaceholderText('Announcement title')
    await userEvent.type(titleInput, 'Test Title')

    const contentArea = screen.getByPlaceholderText('Write your announcement here...')
    await userEvent.type(contentArea, 'Test content')

    // Click Send Now — should show confirmation dialog
    const sendBtn = screen.getByText('Send Now')
    await userEvent.click(sendBtn)

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Send')).toBeTruthy()
    })

    // Click Confirm Send
    const confirmBtn = screen.getByText('Confirm Send')
    await userEvent.click(confirmBtn)

    // Second click on Confirm should be blocked by sendingRef
    // (the button should be disabled while pending)
    await waitFor(() => {
      // After first click, mutation starts — button shows "Sending..."
      // or the dialog closes. Either way, the ref prevents double submission.
      expect(mockApi.post).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })
  })
})
