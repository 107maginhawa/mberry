import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
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

  test('filter selection triggers audience type change', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Click "By Category" to switch audience type
    const byCategoryBtn = screen.getByText('By Category')
    await userEvent.click(byCategoryBtn)

    // The "By Category" button should now have the default variant (selected)
    await waitFor(() => {
      expect(byCategoryBtn.getAttribute('data-variant')).toBe('default')
    })

    // "All Members" button should have the outline variant (unselected)
    const allMembersBtn = screen.getByText('All Members')
    expect(allMembersBtn.getAttribute('data-variant')).toBe('outline')
  })

  test('channel switches toggle correctly', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Send Now button should be enabled initially
    const sendBtn = screen.getByText('Send Now')
    expect(sendBtn).not.toBeDisabled()

    // There are 2 channel switches: Push (default on) and Email (default off)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)

    // Push switch should be checked by default
    expect(switches[0].getAttribute('aria-checked')).toBe('true')
    // Email switch should be unchecked by default
    expect(switches[1].getAttribute('aria-checked')).toBe('false')

    // Toggle push off
    await userEvent.click(switches[0])
    expect(switches[0].getAttribute('aria-checked')).toBe('false')

    // Toggle email on
    await userEvent.click(switches[1])
    expect(switches[1].getAttribute('aria-checked')).toBe('true')
  })

  test('all channel switches can be turned off', async () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Turn off all channel switches
    const switches = screen.getAllByRole('switch')
    for (const sw of switches) {
      if (sw.getAttribute('aria-checked') === 'true') {
        await userEvent.click(sw)
      }
    }

    // All switches should now be off
    for (const sw of switches) {
      expect(sw.getAttribute('aria-checked')).toBe('false')
    }

    // Send Now button should still be present (no client-side channel validation)
    expect(screen.getByText('Send Now')).toBeTruthy()
  })

  test('send triggers mutation and disables button while pending', async () => {
    // Make the post hang so we can observe the pending state
    let resolvePost: (val: any) => void
    mockApi.post.mockReturnValue(new Promise((res) => { resolvePost = res }))

    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Fill required fields
    const titleInput = screen.getByPlaceholderText('Announcement title')
    await userEvent.type(titleInput, 'Test Title')

    const contentArea = screen.getByPlaceholderText('Write your announcement here...')
    await userEvent.type(contentArea, 'Test content')

    // Click Send Now — directly triggers mutation (no confirmation dialog)
    const sendBtn = screen.getByText('Send Now')
    await userEvent.click(sendBtn)

    // The mutation should have been called
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })

    // While pending, button should show "Sending..." and be disabled
    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeTruthy()
      expect(screen.getByText('Sending...')).toBeDisabled()
    })

    // Resolve the pending mutation
    resolvePost!({ data: { id: 'ann-1' } })
  })
})
