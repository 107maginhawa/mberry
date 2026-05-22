import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OrgSettingsForm } from './org-settings-form'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock @monobase/ui
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Input: ({ value, onChange, placeholder, type, ...props }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} type={type} {...props} />
  ),
  Textarea: ({ value, onChange, placeholder, rows, ...props }: any) => (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} {...props} />
  ),
  Label: ({ children, className }: any) => <label className={className}>{children}</label>,
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

import { api } from '@/lib/api'
const mockApiGet = api.get as ReturnType<typeof vi.fn>

describe('OrgSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons while fetching org profile', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<OrgSettingsForm orgId="org-1" />)
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders org profile fields after loading', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        name: 'Philippine Dental Assoc',
        description: 'A professional dental organization',
        logoUrl: '',
        contactEmail: 'info@pda.org',
        phone: '+63 2 8123 4567',
        address: '123 Dental St, Manila',
        website: 'https://pda.org',
        foundingDate: '1990-06-15',
      },
    })

    renderWithProviders(<OrgSettingsForm orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Organization Profile')).toBeInTheDocument()
    })

    expect(screen.getByText('Philippine Dental Assoc')).toBeInTheDocument()
    expect(screen.getByText('A professional dental organization')).toBeInTheDocument()
    expect(screen.getByText('info@pda.org')).toBeInTheDocument()
    expect(screen.getByText('+63 2 8123 4567')).toBeInTheDocument()
    expect(screen.getByText('123 Dental St, Manila')).toBeInTheDocument()
  })

  test('shows Edit button when not in editing mode', async () => {
    mockApiGet.mockResolvedValue({ data: { name: 'Test Org' } })
    renderWithProviders(<OrgSettingsForm orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  test('shows placeholder text for empty fields', async () => {
    mockApiGet.mockResolvedValue({ data: { name: 'Test Org' } })
    renderWithProviders(<OrgSettingsForm orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument()
    })

    // Empty optional fields show "Not set" placeholders
    const notSetElements = screen.getAllByText('Not set')
    expect(notSetElements.length).toBeGreaterThan(0)
  })

  test('renders website as a link when set', async () => {
    mockApiGet.mockResolvedValue({
      data: { name: 'Test Org', website: 'https://example.com' },
    })

    renderWithProviders(<OrgSettingsForm orgId="org-1" />)

    await waitFor(() => {
      const link = screen.getByText('https://example.com')
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  test('handles fetch failure gracefully (empty profile)', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))
    renderWithProviders(<OrgSettingsForm orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Organization Profile')).toBeInTheDocument()
    })
    // Falls back to empty profile — no crash
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })
})
