import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ComposeForm } from './compose-form'

// Router (useNavigate, useParams) provided by global mock in test-setup-root.ts.
// @monobase/ui rendered as real components against happy-dom.

// Mock date-picker. The real component uses `onValueChange(iso)`, so the mock
// must wire keystrokes through that prop (not `onChange`) for the value to flow.
vi.mock('@/components/patterns/date-picker', () => ({
  DateTimePicker: ({ value, onValueChange, placeholder }: any) => (
    <input
      data-testid="datetime-picker"
      type="text"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e: any) => onValueChange?.(e.target.value)}
    />
  ),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

import { api } from '@/lib/api'
const mockApi = api as unknown as { post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> }

describe('ComposeForm', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
  })

  test('renders form fields', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
    expect(screen.getByText('Audience')).toBeInTheDocument()
    expect(screen.getByText('Channels')).toBeInTheDocument()
    expect(screen.getByText('Visibility')).toBeInTheDocument()
  })

  test('renders action buttons', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)

    expect(screen.getByText('Send Now')).toBeInTheDocument()
    expect(screen.getByText('Save Draft')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('shows character count for title', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)
    expect(screen.getByText('0/200')).toBeInTheDocument()
  })

  test('shows audience type buttons (All Members / By Category)', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)
    expect(screen.getByText('All Members')).toBeInTheDocument()
    expect(screen.getByText('By Category')).toBeInTheDocument()
  })

  test('shows visibility options (Internal / Network)', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)
    expect(screen.getByText('Internal (Members Only)')).toBeInTheDocument()
    expect(screen.getByText('Network (Public)')).toBeInTheDocument()
  })

  test('shows channel toggles for Push and Email', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)
    expect(screen.getByText('Push Notification')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  test('shows validation error when title is empty on send', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ComposeForm orgId="org-1" />)

    await user.click(screen.getByText('Send Now'))

    expect(screen.getByText('Title is required')).toBeInTheDocument()
  })

  test('shows validation error when content is empty on send', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ComposeForm orgId="org-1" />)

    // Fill title but leave content empty
    await user.type(screen.getByLabelText('Title'), 'Test Title')
    await user.click(screen.getByText('Send Now'))

    expect(screen.getByText('Content is required')).toBeInTheDocument()
  })

  test('pre-fills form when editing existing announcement', () => {
    renderWithProviders(
      <ComposeForm
        orgId="org-1"
        existingAnnouncement={{
          id: 'ann-1',
          title: 'Existing Title',
          content: 'Existing content body',
          audienceType: 'all',
          channelPush: true,
          channelEmail: false,
          visibility: 'internal',
        }}
      />
    )

    expect(screen.getByDisplayValue('Existing Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing content body')).toBeInTheDocument()
  })

  test('shows schedule input field', () => {
    renderWithProviders(<ComposeForm orgId="org-1" />)
    expect(screen.getByText('Schedule (optional)')).toBeInTheDocument()
    expect(screen.getByText('Leave empty to send immediately or save as draft')).toBeInTheDocument()
  })

  // FIX-003: "Send Now" must actually publish. createAnnouncement force-drafts,
  // so the component MUST chain create → publish endpoint. Previously it only
  // POSTed status:'sent' (silently ignored) and navigated away on a draft.
  test('Send Now chains create then publish endpoint', async () => {
    const user = userEvent.setup()
    // ISSUE-029: createAnnouncement returns the flat resource, not { data }.
    mockApi.post.mockResolvedValueOnce({ id: 'new-ann-1' }) // create
    mockApi.post.mockResolvedValueOnce({ id: 'new-ann-1', status: 'sent' }) // publish

    renderWithProviders(<ComposeForm orgId="org-1" />)
    await user.type(screen.getByLabelText('Title'), 'Town Hall')
    await user.type(screen.getByLabelText('Message'), 'Meeting on Friday')
    await user.click(screen.getByText('Send Now'))

    await waitFor(() => {
      // create
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/communications/announcements/org-1',
        expect.objectContaining({ title: 'Town Hall' }),
      )
      // publish the created id
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/communications/announcements/new-ann-1/publish',
        expect.anything(),
      )
    })
  })

  // FIX-003: "Schedule" must hit the schedule endpoint with scheduledAt.
  test('Schedule chains create then schedule endpoint with scheduledAt', async () => {
    const user = userEvent.setup()
    // ISSUE-029: createAnnouncement returns the flat resource, not { data }.
    mockApi.post.mockResolvedValueOnce({ id: 'new-ann-2' }) // create
    mockApi.post.mockResolvedValueOnce({ id: 'new-ann-2', status: 'scheduled' }) // schedule

    renderWithProviders(<ComposeForm orgId="org-1" />)
    await user.type(screen.getByLabelText('Title'), 'Future Notice')
    await user.type(screen.getByLabelText('Message'), 'Later')

    // Set a future schedule so the Schedule button appears
    const picker = screen.getByTestId('datetime-picker')
    const future = new Date(Date.now() + 86400000).toISOString()
    fireEvent.change(picker, { target: { value: future } })

    await user.click(await screen.findByText('Schedule'))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/communications/announcements/org-1',
        expect.objectContaining({ title: 'Future Notice' }),
      )
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/communications/announcements/new-ann-2/schedule',
        expect.objectContaining({ scheduledAt: expect.any(String) }),
      )
    })
  })
})
