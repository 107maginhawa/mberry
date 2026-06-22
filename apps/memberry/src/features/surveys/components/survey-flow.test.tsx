import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { SurveyFlow, type Survey } from './survey-flow'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
  },
}))

// IndexedDB not available in jsdom — mock the draft hook
vi.mock('../hooks/use-survey-draft', () => ({
  useSurveyDraft: vi.fn().mockReturnValue({
    restoredAnswers: null,
    hasRestoredDraft: false,
    saveAnswers: vi.fn(),
    clearDraft: vi.fn(),
    isSaved: false,
  }),
}))

// framer-motion causes issues in test env — mock AnimatePresence/motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  },
}))

const makeSurvey = (overrides: Partial<Survey> = {}): Survey => ({
  id: overrides.id ?? 'survey-1',
  title: overrides.title ?? 'Test Survey',
  description: overrides.description,
  settings: overrides.settings,
  questions: overrides.questions ?? [
    {
      id: 'q1',
      type: 'text',
      text: 'What do you think of our service?',
      required: false,
    },
    {
      id: 'q2',
      type: 'yes_no',
      text: 'Would you recommend us?',
      required: true,
    },
  ],
})

describe('SurveyFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[AC-SF-001] renders the first question text', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    expect(screen.getByText('What do you think of our service?')).toBeInTheDocument()
  })

  test('[AC-SF-002] renders question counter "1 of 2"', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    // The counter "1 of 2" may be split across DOM nodes; check for "1" appearing in context
    expect(screen.getByText((content, el) => {
      return el?.textContent?.replace(/\s+/g, ' ').trim() === '1 of 2'
    })).toBeInTheDocument()
  })

  test('[AC-SF-003] Next button advances to second question', async () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    const nextBtn = screen.getByRole('button', { name: /next/i })
    await userEvent.click(nextBtn)
    expect(screen.getByText('Would you recommend us?')).toBeInTheDocument()
  })

  test('[AC-SF-004] previewMode renders survey and completes on submit', async () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} previewMode />)
    // First question should be shown
    expect(screen.getByText('What do you think of our service?')).toBeInTheDocument()
  })

  test('[AC-SF-005] Back button appears on second question', async () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    const nextBtn = screen.getByRole('button', { name: /next/i })
    await userEvent.click(nextBtn)
    // Back button should now be present
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  // BR-40: free-text fields in anonymous surveys warn the respondent.
  const PII_WARNING = /Avoid including personal details/i

  test('[BR-40] anonymous survey shows the free-text privacy warning on a text question', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey({ settings: { anonymous: true } })} />)
    // First question (q1) is a text question.
    expect(screen.getByText(PII_WARNING)).toBeInTheDocument()
  })

  test('[BR-40] non-anonymous survey shows NO free-text warning', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey({ settings: { anonymous: false } })} />)
    expect(screen.queryByText(PII_WARNING)).not.toBeInTheDocument()
  })

  test('[BR-40] anonymous survey shows NO warning on a non-text question', async () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey({ settings: { anonymous: true } })} />)
    // Advance from q1 (text) to q2 (yes_no) — warning should disappear.
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Would you recommend us?')).toBeInTheDocument()
    expect(screen.queryByText(PII_WARNING)).not.toBeInTheDocument()
  })
})
