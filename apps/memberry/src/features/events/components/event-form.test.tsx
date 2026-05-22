import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { EventForm } from './event-form'

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  createEventMutation: vi.fn(),
  updateEventMutation: vi.fn(),
  searchEventsQueryKey: vi.fn(() => ['events']),
}))

vi.mock('@monobase/ui', () => ({
  Input: ({ children, ...props }: any) => <input {...props} />,
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  Textarea: ({ children, ...props }: any) => <textarea {...props} />,
  Button: ({ children, onClick, type, disabled, variant, className }: any) => (
    <button onClick={onClick} type={type ?? 'button'} disabled={disabled} className={className} data-variant={variant}>
      {children}
    </button>
  ),
  Select: ({ children, value, onValueChange }: any) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children, id, className }: any) => <button id={id} type="button" className={className}>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}))

import {
  createEventMutation,
  updateEventMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const mockCreateMutation = createEventMutation as ReturnType<typeof vi.fn>
const mockUpdateMutation = updateEventMutation as ReturnType<typeof vi.fn>

function setupMocks() {
  mockCreateMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockUpdateMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
}

describe('EventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  test('renders all form sections', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByText('Basic Info')).toBeInTheDocument()
    expect(screen.getByText('Date & Time')).toBeInTheDocument()
    // "Location" appears as both section heading and form label
    expect(screen.getAllByText('Location')).toHaveLength(2)
    expect(screen.getByText('Registration')).toBeInTheDocument()
  })

  test('renders event type selector with options', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByLabelText('Event Type')).toBeInTheDocument()
    expect(screen.getByText('General Assembly')).toBeInTheDocument()
    expect(screen.getByText('Fellowship')).toBeInTheDocument()
    expect(screen.getByText('Medical Mission')).toBeInTheDocument()
  })

  test('renders Save Draft and Publish buttons', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByText('Save Draft')).toBeInTheDocument()
    expect(screen.getByText('Publish')).toBeInTheDocument()
  })

  test('renders Cancel button when onCancel provided', () => {
    const onCancel = vi.fn()
    renderWithProviders(<EventForm orgId="org-1" onCancel={onCancel} />)

    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('hides Cancel button when onCancel not provided', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    // Only "Cancel" in the menu — the form Cancel button should not appear
    const cancelButtons = screen.queryAllByText('Cancel')
    expect(cancelButtons).toHaveLength(0)
  })

  test('pre-fills form fields in edit mode', () => {
    const event = {
      id: 'evt-1',
      title: 'Board Meeting',
      description: 'Monthly board meeting',
      startDate: '2025-06-15T09:00:00Z',
      endDate: '2025-06-15T11:00:00Z',
      location: 'Conference Room A',
      registrationFee: 5000,
      capacity: 20,
      visibility: 'internal',
      status: 'draft',
      eventType: 'board_meeting',
    }

    renderWithProviders(<EventForm orgId="org-1" event={event} />)

    // "Board Meeting" appears in both the title input and the eventType select
    expect(screen.getAllByDisplayValue('Board Meeting')).toHaveLength(2)
    expect(screen.getByDisplayValue('Monthly board meeting')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Conference Room A')).toBeInTheDocument()
    // Fee is divided by 100: 5000 / 100 = 50
    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  test('renders visibility selector', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByLabelText('Visibility')).toBeInTheDocument()
    expect(screen.getByText('Internal (this org only)')).toBeInTheDocument()
    expect(screen.getByText('Network-Wide (all orgs in association)')).toBeInTheDocument()
  })
})
