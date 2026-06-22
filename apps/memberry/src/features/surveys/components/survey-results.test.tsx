import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { SurveyResults } from './survey-results'

// survey-results fetches via api.get inside react-query queryFns.
const apiGet = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
}))

interface SurveyDetailOverrides {
  anonymous?: boolean
  responseCount?: number
}

function mockSurvey({ anonymous = true, responseCount = 5 }: SurveyDetailOverrides) {
  apiGet.mockImplementation((url: string) => {
    if (url.includes('/responses')) {
      // The list endpoint nests the count under pagination.totalCount — the
      // component reads it from there for the count + small-pool banner.
      return Promise.resolve({
        data: [],
        pagination: { totalCount: responseCount, totalPages: 1 },
      })
    }
    return Promise.resolve({
      id: 'survey-1',
      title: 'Member Satisfaction',
      surveyType: 'survey',
      status: 'active',
      // BR-40: API nests the anonymity flag under settings (not flat).
      settings: { anonymous },
      questions: [],
    })
  })
}

const SMALL_POOL = /fewer than 10/i

describe('SurveyResults — BR-40 small-pool anonymity warning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[BR-40] warns the creator when an anonymous survey has <10 responses', async () => {
    mockSurvey({ anonymous: true, responseCount: 5 })
    renderWithProviders(<SurveyResults orgId="org-1" surveyId="survey-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(SMALL_POOL)
  })

  test('[BR-40] no warning when an anonymous survey has >=10 responses', async () => {
    mockSurvey({ anonymous: true, responseCount: 12 })
    renderWithProviders(<SurveyResults orgId="org-1" surveyId="survey-1" />)
    // Header renders once the survey loads; the warning must be absent.
    await waitFor(() => expect(screen.getByText('Member Satisfaction')).toBeInTheDocument())
    expect(screen.queryByText(SMALL_POOL)).not.toBeInTheDocument()
  })

  test('[BR-40] no warning for a non-anonymous survey, even with <10 responses', async () => {
    mockSurvey({ anonymous: false, responseCount: 3 })
    renderWithProviders(<SurveyResults orgId="org-1" surveyId="survey-1" />)
    await waitFor(() => expect(screen.getByText('Member Satisfaction')).toBeInTheDocument())
    expect(screen.queryByText(SMALL_POOL)).not.toBeInTheDocument()
  })

  test('[BR-40] no warning at zero responses — nothing to infer yet', async () => {
    mockSurvey({ anonymous: true, responseCount: 0 })
    renderWithProviders(<SurveyResults orgId="org-1" surveyId="survey-1" />)
    await waitFor(() => expect(screen.getByText('Member Satisfaction')).toBeInTheDocument())
    expect(screen.queryByText(SMALL_POOL)).not.toBeInTheDocument()
  })
})
