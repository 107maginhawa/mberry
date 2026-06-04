import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ComposeForm } from './compose-form'

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
}))

// Mock date-picker
vi.mock('@/components/patterns/date-picker', () => ({
  DateTimePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="datetime-picker" type="text" value={value ?? ''} onChange={(e: any) => onChange?.(e.target.value)} {...rest} />
  ),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

describe('ComposeForm', () => {
  beforeEach(() => {
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
})
