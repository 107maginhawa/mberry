import { describe, it, expect, vi, beforeEach } from '@/test/vitest-shim'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpecialAssessmentsList } from './special-assessments-list'

// Mock sonner
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('SpecialAssessmentsList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading skeleton', () => {
    render(<SpecialAssessmentsList orgId="org-1" />, { wrapper })
    expect(screen.getByText('Special Assessments')).toBeTruthy()
  })

  it('renders empty state when no assessments', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ assessments: [] })

    render(<SpecialAssessmentsList orgId="org-1" />, { wrapper })
    expect(await screen.findByText(/no special assessments/i)).toBeTruthy()
  })

  it('renders assessment rows', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({
      assessments: [{
        id: 'sa-1',
        name: 'Building Fund',
        description: null,
        amount: 50000,
        currency: 'PHP',
        dueDate: '2026-06-01',
        fundId: null,
        appliesTo: 'all',
        status: 'draft',
        createdAt: '2026-05-24T00:00:00Z',
        collection: null,
      }],
    })

    render(<SpecialAssessmentsList orgId="org-1" />, { wrapper })
    expect(await screen.findByText('Building Fund')).toBeTruthy()
    expect(screen.getByText('2026-06-01')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
  })

  it('shows New Assessment button', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ assessments: [] })

    render(<SpecialAssessmentsList orgId="org-1" />, { wrapper })
    expect(await screen.findByText(/new assessment/i)).toBeTruthy()
  })
})
