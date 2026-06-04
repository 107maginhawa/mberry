import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { TemplateForm } from '../components/template-form'
import { TemplatePreview } from '../components/template-preview'

// Router (Link, useNavigate) provided by global mock in test-setup-root.ts.
// @monobase/ui rendered as real components against happy-dom.

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock api — vi.hoisted because vi.mock is hoisted above variable declarations
const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  api: mockApi,
}))

describe('Template Library (VS-030)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TemplateForm - CRUD', () => {
    test('create template with merge fields submits correct payload', async () => {
      const user = userEvent.setup()
      mockApi.post.mockResolvedValueOnce({ data: { id: 'tpl-1' } })

      renderWithProviders(
        <TemplateForm orgId="org-1" onSuccess={vi.fn()} />
      )

      // Fill required fields
      await user.type(screen.getByLabelText('Template Name'), 'Welcome Email')
      // Use click + paste for body to avoid userEvent interpreting { as special key
      const bodyEl = screen.getByLabelText('Body')
      await user.click(bodyEl)
      await user.paste('Hello {{member.name}}, welcome to {{org.name}}!')

      // Submit
      await user.click(screen.getByText('Save Template'))

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/api/association/message-templates',
          expect.objectContaining({
            organizationId: 'org-1',
            name: 'Welcome Email',
            body: 'Hello {{member.name}}, welcome to {{org.name}}!',
            mergeFields: expect.arrayContaining(['member.name', 'org.name']),
          })
        )
      })
    })
  })

  describe('TemplateForm - Merge Field Toolbar', () => {
    test('click "Member Name" inserts {{member.name}} into body', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <TemplateForm orgId="org-1" onSuccess={vi.fn()} />
      )

      // Click merge field button
      await user.click(screen.getByText('Member Name'))

      // Body should contain the merge field
      const body = screen.getByLabelText('Body') as HTMLTextAreaElement
      expect(body.value).toContain('{{member.name}}')
    })
  })

  describe('TemplatePreview', () => {
    test('renders merge fields with sample data', () => {
      renderWithProviders(
        <TemplatePreview
          body="Hello {{member.name}}, your dues are {{member.duesAmount}} for {{org.name}}. ID: {{member.memberNumber}}"
          subject="Welcome {{member.name}}"
        />
      )

      // Multiple elements contain the name (subject + body), so use getAllByText
      expect(screen.getAllByText(/Dr\. Maria Santos/).length).toBeGreaterThan(0)
      expect(screen.getByText(/Philippine Dental Association/)).toBeInTheDocument()
      // Check the preview heading
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })
  })

  describe('TemplateForm - Edit mode', () => {
    test('pre-fills form when editing existing template', () => {
      renderWithProviders(
        <TemplateForm
          orgId="org-1"
          onSuccess={vi.fn()}
          existingTemplate={{
            id: 'tpl-1',
            name: 'Existing Template',
            channel: 'email',
            category: 'announcement',
            subject: 'Test Subject',
            body: 'Test body with {{member.name}}',
            mergeFields: ['member.name'],
            status: 'active',
          }}
        />
      )

      expect(screen.getByDisplayValue('Existing Template')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Subject')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test body with {{member.name}}')).toBeInTheDocument()
    })
  })

  describe('Template List', () => {
    test('renders templates and search filters by name', async () => {
      // This test validates the TemplateList component renders
      // and filters. We import it dynamically to keep test isolation.
      const { TemplateList } = await import('../components/template-list')
      const user = userEvent.setup()

      mockApi.get.mockResolvedValueOnce({
        data: [
          { id: 'tpl-1', name: 'Welcome Email', channel: 'email', category: 'announcement', status: 'active' },
          { id: 'tpl-2', name: 'Dues Reminder', channel: 'push', category: 'reminder', status: 'draft' },
        ],
      })

      renderWithProviders(
        <TemplateList orgId="org-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome Email')).toBeInTheDocument()
        expect(screen.getByText('Dues Reminder')).toBeInTheDocument()
      })

      // Search
      await user.type(screen.getByPlaceholderText('Search templates...'), 'Welcome')

      // Only matching template visible
      expect(screen.getByText('Welcome Email')).toBeInTheDocument()
      expect(screen.queryByText('Dues Reminder')).not.toBeInTheDocument()
    })
  })
})
