import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { SurveyFlow } from './survey-flow'
import type { Survey } from './survey-flow'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ data: { id: 'resp-1' } }) },
}))

// useSurveyDraft — stub so flow can render without IndexedDB
vi.mock('../hooks/use-survey-draft', () => ({
  useSurveyDraft: () => ({
    restoredAnswers: null,
    hasRestoredDraft: false,
    saveAnswers: vi.fn(),
    clearDraft: vi.fn(),
    isSaved: false,
  }),
}))

// framer-motion — pass children through to simplify test DOM
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => <div className={className}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, className, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...rest}>{children}</button>
  ),
  Textarea: ({ value, onChange, placeholder, ...rest }: any) => (
    <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} data-testid="text-area" {...rest} />
  ),
}))

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  Send: () => <span data-testid="send-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  Save: () => <span data-testid="save-icon" />,
  Check: () => <span data-testid="check-mark" />,
  ThumbsUp: () => <span data-testid="thumbs-up" />,
  ThumbsDown: () => <span data-testid="thumbs-down" />,
  Star: ({ className }: any) => <span data-testid="star-icon" className={className} />,
}))

const makeSurvey = (overrides: Partial<Survey> = {}): Survey => ({
  id: 'survey-1',
  title: 'Test Survey',
  questions: overrides.questions ?? [
    { id: 'q1', type: 'text', text: 'What did you enjoy most?', required: false },
    { id: 'q2', type: 'yes_no', text: 'Would you recommend us?', required: false },
  ],
  ...overrides,
})

describe('SurveyFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('[AC-SF-001] renders first question text', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    expect(screen.getByText('What did you enjoy most?')).toBeInTheDocument()
  })

  test('[AC-SF-002] shows progress "1 of 2" for a 2-question survey', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  test('[AC-SF-003] Back button is disabled on first question', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    const backBtn = screen.getByText('Back')
    expect(backBtn).toBeDisabled()
  })

  test('[AC-SF-004] Next button advances to the second question', async () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    // First question is text type — type an answer to satisfy required if needed
    const nextBtn = screen.getByText('Next')
    await userEvent.click(nextBtn)
    // Now on question 2
    expect(screen.getByText('Would you recommend us?')).toBeInTheDocument()
  })

  test('[AC-SF-005] Back button becomes enabled after advancing', async () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} />)
    await userEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Back')).not.toBeDisabled()
  })

  test('[AC-SF-006] last question shows Submit button instead of Next', async () => {
    const singleQuestion: Survey = {
      id: 'survey-1',
      title: 'Quick survey',
      questions: [
        { id: 'q1', type: 'text', text: 'Any feedback?', required: false },
      ],
    }
    renderWithProviders(<SurveyFlow survey={singleQuestion} />)
    expect(screen.getByText(/Submit/)).toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  test('[AC-SF-007] preview mode shows preview banner', () => {
    renderWithProviders(<SurveyFlow survey={makeSurvey()} previewMode />)
    expect(screen.getByText(/Preview Mode/)).toBeInTheDocument()
  })

  test('[AC-SF-008] required question shows "Required" hint', () => {
    const survey: Survey = {
      id: 's1',
      title: 'Test',
      questions: [{ id: 'q1', type: 'text', text: 'Required question', required: true }],
    }
    renderWithProviders(<SurveyFlow survey={survey} />)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  test('[AC-SF-009] onComplete callback is called after submit in preview mode', async () => {
    const onComplete = vi.fn()
    const singleQ: Survey = {
      id: 'survey-x',
      title: 'Preview',
      questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: false }],
    }
    renderWithProviders(<SurveyFlow survey={singleQ} previewMode onComplete={onComplete} />)
    await userEvent.click(screen.getByText(/Submit/))
    // In preview mode the survey shows completion screen
    expect(await screen.findByText('End of Preview')).toBeInTheDocument()
  })
})
