import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { Button, Textarea } from '@monobase/ui'
import { toast } from 'sonner'
import { api } from '@/lib/api'

// ── Types ────────────────────────────────────────────────────────────

export interface NpsSurvey {
  id: string
  title: string
  questionText?: string
}

interface NpsModalProps {
  survey: NpsSurvey
  onDismiss: () => void
  onComplete: () => void
}

// ── Dismiss helpers ─────────────────────────────────────────────────

export function isDismissedLocally(surveyId: string): boolean {
  try {
    return localStorage.getItem(`nps-dismissed-${surveyId}`) === 'true'
  } catch {
    return false
  }
}

function markDismissedLocally(surveyId: string): void {
  try {
    localStorage.setItem(`nps-dismissed-${surveyId}`, 'true')
  } catch {
    // localStorage not available
  }
}

async function dismissOnServer(surveyId: string): Promise<void> {
  try {
    await api.post(`/surveys/${surveyId}/responses/dismiss`)
    markDismissedLocally(surveyId)
  } catch {
    // Fallback: still mark locally so user isn't re-prompted this session
    markDismissedLocally(surveyId)
  }
}

// ── Component ────────────────────────────────────────────────────────

export function NpsModal({ survey, onDismiss, onComplete }: NpsModalProps) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showComment, setShowComment] = useState(false)

  const handleSelectScore = useCallback((n: number) => {
    setScore(n)
    setShowComment(true)
  }, [])

  const handleDismiss = useCallback(() => {
    dismissOnServer(survey.id)
    onDismiss()
  }, [survey.id, onDismiss])

  const handleSubmit = useCallback(async () => {
    if (score === null || submitting) return
    setSubmitting(true)
    try {
      await api.post(`/surveys/${survey.id}/responses`, {
        answers: [
          { questionId: 'nps', value: score },
          ...(comment.trim() ? [{ questionId: 'nps_comment', value: comment.trim() }] : []),
        ],
      })
      toast.success('Thanks for your feedback!')
      markDismissedLocally(survey.id)
      onComplete()
    } catch {
      toast.error('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [score, submitting, survey.id, comment, onComplete])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-md)] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)] pr-4 leading-tight">
            {survey.title}
          </h3>
          <Button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] transition-colors"
            aria-label="Dismiss survey"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Question */}
        <div className="px-4 pb-3">
          <p className="text-xs text-[var(--color-muted)] mb-3">
            {survey.questionText ?? 'How likely are you to recommend us to a colleague?'}
          </p>

          {/* NPS Scale — compact */}
          <div className="flex gap-1" role="radiogroup" aria-label="NPS score from 0 to 10">
            {Array.from({ length: 11 }, (_, i) => (
              <Button
                key={i}
                type="button"
                role="radio"
                aria-checked={score === i}
                aria-label={`${i} - ${i === 0 ? 'Not at all likely' : i <= 2 ? 'Not likely' : i <= 4 ? 'Unlikely' : i === 5 ? 'Neutral' : i === 6 ? 'Somewhat likely' : i <= 8 ? 'Likely' : i === 9 ? 'Very likely' : 'Extremely likely'}`}
                onClick={() => handleSelectScore(i)}
                className={`flex-1 h-8 text-xs font-semibold rounded-[4px] transition-all
                  ${
                    score === i
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-elevated-hover)]'
                  }`}
              >
                {i}
              </Button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-muted)] mt-1 px-0.5">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>

        {/* Comment + Submit (appears after score selection) */}
        <AnimatePresence>
          {showComment && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Any additional feedback? (optional)"
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
                />
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={score === null || submitting}
                    className="gap-1.5 h-8 text-xs"
                  >
                    {submitting ? 'Sending...' : (
                      <>
                        Submit <Send size={12} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
