import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Send, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@monobase/ui'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSurveyDraft } from '../hooks/use-survey-draft'
import { NpsQuestion } from './question-renderers/nps-question'
import { RatingQuestion } from './question-renderers/rating-question'
import { ChoiceQuestion } from './question-renderers/choice-question'
import { TextQuestion } from './question-renderers/text-question'
import { YesNoQuestion } from './question-renderers/yes-no-question'

// ── Types ────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  id: string
  type: 'nps' | 'rating' | 'single_choice' | 'multi_choice' | 'text' | 'yes_no'
  text: string
  required?: boolean
  options?: string[]
  maxLength?: number
  maxStars?: number
}

export interface Survey {
  id: string
  title: string
  description?: string
  questions: SurveyQuestion[]
}

type AnswerValue = number | string | string[] | boolean | null

// ── Slide variants ───────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
}

const slideTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
}

// ── Question renderer dispatch ───────────────────────────────────────

function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: AnswerValue
  onChange: (v: AnswerValue) => void
}) {
  switch (question.type) {
    case 'nps':
      return (
        <NpsQuestion
          value={typeof value === 'number' ? value : null}
          onChange={(v) => onChange(v)}
        />
      )
    case 'rating':
      return (
        <RatingQuestion
          value={typeof value === 'number' ? value : null}
          onChange={(v) => onChange(v)}
          maxStars={question.maxStars}
        />
      )
    case 'single_choice':
      return (
        <ChoiceQuestion
          options={question.options ?? []}
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v)}
        />
      )
    case 'multi_choice':
      return (
        <ChoiceQuestion
          options={question.options ?? []}
          value={Array.isArray(value) ? value : null}
          onChange={(v) => onChange(v)}
          multiSelect
        />
      )
    case 'text':
      return (
        <TextQuestion
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v)}
          maxLength={question.maxLength}
        />
      )
    case 'yes_no':
      return (
        <YesNoQuestion
          value={typeof value === 'boolean' ? value : null}
          onChange={(v) => onChange(v)}
        />
      )
    default:
      return <p className="text-[var(--color-muted)]">Unsupported question type</p>
  }
}

// ── Component ────────────────────────────────────────────────────────

interface SurveyFlowProps {
  survey: Survey
  onComplete?: () => void
  /** Preview mode — disables submission and shows preview banner */
  previewMode?: boolean
}

export function SurveyFlow({ survey, onComplete, previewMode }: SurveyFlowProps) {
  const { questions } = survey
  const total = questions.length

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Offline draft persistence
  const { restoredAnswers, hasRestoredDraft, saveAnswers, clearDraft, isSaved } = useSurveyDraft({
    surveyId: survey.id,
    enabled: !previewMode,
  })

  // Restore draft answers on mount
  useEffect(() => {
    if (hasRestoredDraft && restoredAnswers) {
      setAnswers(restoredAnswers as Record<string, AnswerValue>)
      toast.info('Draft restored — your previous answers have been loaded')
    }
  }, [hasRestoredDraft, restoredAnswers])

  const currentQuestion = questions[currentIndex]!
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? null : null
  const isLast = currentIndex === total - 1

  const hasAnswer = useCallback(
    (val: AnswerValue): boolean => {
      if (val === null || val === undefined) return false
      if (typeof val === 'string') return val.trim().length > 0
      if (Array.isArray(val)) return val.length > 0
      return true
    },
    [],
  )

  const canAdvance = hasAnswer(currentAnswer) || !currentQuestion?.required

  const goNext = useCallback(() => {
    if (!canAdvance) return
    if (isLast) return
    setDirection(1)
    setCurrentIndex((i) => i + 1)
  }, [canAdvance, isLast])

  const goPrev = useCallback(() => {
    if (currentIndex === 0) return
    setDirection(-1)
    setCurrentIndex((i) => i - 1)
  }, [currentIndex])

  const handleSubmit = useCallback(async () => {
    if (previewMode) {
      setCompleted(true)
      toast.info('Preview complete — this is how members will see your survey.')
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const formattedAnswers = questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id] ?? null,
      }))
      await api.post(`/api/surveys/${survey.id}/responses`, { answers: formattedAnswers })
      clearDraft()
      setCompleted(true)
      toast.success('Survey submitted successfully!')
      onComplete?.()
    } catch {
      toast.error('Failed to submit survey. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [previewMode, submitting, questions, answers, survey.id, onComplete])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (completed) return
      if (e.key === 'Enter' && canAdvance) {
        e.preventDefault()
        if (isLast) {
          handleSubmit()
        } else {
          goNext()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canAdvance, isLast, goNext, goPrev, handleSubmit, completed])

  // ── Completion screen ──────────────────────────────────────────────

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <CheckCircle2 size={72} className="text-[var(--color-success)]" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <h2 className="text-h2">
            {previewMode ? 'End of Preview' : 'Thank you for your feedback!'}
          </h2>
          <p className="text-body-sm text-[var(--color-muted)]">
            {previewMode
              ? 'This is the completion screen members will see after submitting.'
              : 'Your responses have been recorded.'}
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Progress bar ───────────────────────────────────────────────────

  const progress = ((currentIndex + 1) / total) * 100

  return (
    <div className="flex flex-col min-h-[60vh]">
      {/* Preview banner */}
      {previewMode && (
        <div className="mb-4 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] border border-[var(--color-warning)] text-[var(--color-warning)] text-sm font-medium text-center">
          Preview Mode — This is how members will see your survey
        </div>
      )}

      {/* Progress */}
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[var(--color-muted)]">
            {currentIndex + 1} of {total}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {Math.round(progress)}%
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-elevated)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-primary)]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQuestion.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="w-full max-w-xl space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-h3 text-[var(--color-text)]">
                {currentQuestion.text}
              </h2>
              {currentQuestion.required && (
                <p className="text-xs text-[var(--color-muted)]">Required</p>
              )}
            </div>

            <QuestionRenderer
              question={currentQuestion}
              value={currentAnswer}
              onChange={(v) => {
                const updated = { ...answers, [currentQuestion.id]: v }
                setAnswers(updated)
                saveAnswers(updated)
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-surface-border-glass)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ChevronLeft size={16} />
          Back
        </Button>

        {isLast ? (
          <Button
            onClick={handleSubmit}
            disabled={!canAdvance || submitting}
            className="gap-2"
          >
            {submitting ? (
              <>Submitting...</>
            ) : (
              <>
                Submit <Send size={16} />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={goNext}
            disabled={!canAdvance}
            className="gap-1"
          >
            Next <ChevronRight size={16} />
          </Button>
        )}
      </div>

      {/* Draft saved indicator */}
      {isSaved && !previewMode && (
        <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-[var(--color-success)]">
          <Save className="w-3 h-3" />
          Draft saved
        </div>
      )}

      {/* Keyboard hint */}
      <p className="text-center text-xs text-[var(--color-muted)] mt-4 hidden md:block">
        Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-text)] text-[10px] font-mono">Enter</kbd> to continue,{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-text)] text-[10px] font-mono">Esc</kbd> to go back
      </p>
    </div>
  )
}
