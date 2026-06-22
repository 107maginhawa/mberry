import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Plus, Eye } from 'lucide-react'
import { Button, Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@monobase/ui'
import { SurveyFlow } from './survey-flow'
import { DateTimePicker } from '@/components/patterns/date-picker'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { QuestionEditor, type SurveyQuestion, type QuestionType } from './question-editor'

const basicsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  surveyType: z.enum(['nps', 'satisfaction', 'poll', 'custom']),
  anonymous: z.boolean(),
  deadline: z.string().optional(),
})

type BasicsFormData = z.infer<typeof basicsSchema>

type Step = 'basics' | 'questions' | 'review'

const STEPS: { key: Step; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'questions', label: 'Questions' },
  { key: 'review', label: 'Review' },
]

const SURVEY_TYPE_LABELS: Record<string, string> = {
  nps: 'NPS',
  satisfaction: 'Satisfaction',
  poll: 'Poll',
  custom: 'Custom',
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function makeDefaultQuestion(sortOrder: number): SurveyQuestion {
  return {
    id: generateId(),
    type: 'single_choice',
    text: '',
    required: true,
    options: ['', ''],
    sortOrder,
  }
}

interface SurveyBuilderProps {
  orgId: string
  onSuccess?: (survey: { id: string }) => void
  onCancel?: () => void
  initialData?: {
    title?: string
    surveyType?: 'nps' | 'satisfaction' | 'poll' | 'custom'
    questions?: Array<{
      type: QuestionType
      text: string
      required: boolean
      options?: string[]
    }>
  }
}

export function SurveyBuilder({ orgId, onSuccess, onCancel, initialData }: SurveyBuilderProps) {
  const [step, setStep] = useState<Step>('basics')
  const [serverError, setServerError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    initialData?.questions?.length
      ? initialData.questions.map((q, i) => ({
          id: generateId(),
          type: q.type,
          text: q.text,
          required: q.required,
          options: q.options ?? ['', ''],
          sortOrder: i,
        }))
      : [makeDefaultQuestion(0)],
  )
  const [showPreview, setShowPreview] = useState(false)
  const [targetTiers, setTargetTiers] = useState<string[]>([])
  const [targetChapters, setTargetChapters] = useState<string[]>([])
  const [targetCommittees, setTargetCommittees] = useState<string[]>([])

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<BasicsFormData>({
    mode: 'onBlur',
    resolver: zodResolver(basicsSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      description: '',
      surveyType: initialData?.surveyType ?? 'custom',
      anonymous: false,
      deadline: '',
    },
  })

  const formValues = watch()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const createMut = useMutation({
    // Backend route is POST /surveys/ (trailing slash, strict routing); without
    // it the request 405s. Org comes from the x-org-id header.
    mutationFn: (body: unknown) => api.post<{ id: string }>('/api/surveys/', body),
    onSuccess: (data) => {
      toast.success('Survey created')
      onSuccess?.(data)
    },
    onError: (err: Error) => {
      setServerError(err.message)
      toast.error('Failed to create survey')
    },
  })

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  function canProceed() {
    if (step === 'basics') return formValues.title.trim().length > 0
    if (step === 'questions') return questions.some((q) => q.text.trim().length > 0)
    return true
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, makeDefaultQuestion(prev.length)])
  }

  function updateQuestion(id: string, updated: SurveyQuestion) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)))
  }

  function deleteQuestion(id: string) {
    setQuestions((prev) =>
      prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, sortOrder: i })),
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setQuestions((prev) => {
      const oldIndex = prev.findIndex((q) => q.id === active.id)
      const newIndex = prev.findIndex((q) => q.id === over.id)
      return arrayMove(prev, oldIndex, newIndex).map((q, i) => ({ ...q, sortOrder: i }))
    })
  }

  function submitForm(data: BasicsFormData) {
    const targetAudience = (targetTiers.length || targetChapters.length || targetCommittees.length)
      ? { tiers: targetTiers, chapters: targetChapters, committees: targetCommittees }
      : undefined

    const body = {
      organizationId: orgId,
      title: data.title,
      description: data.description || undefined,
      surveyType: data.surveyType,
      anonymous: data.anonymous,
      deadline: data.deadline || undefined,
      settings: {
        anonymous: data.anonymous,
        deadline: data.deadline || undefined,
        targetAudience,
      },
      // The create contract (CreateSurveyRequestSchema → SurveyQuestionSchema)
      // requires each question to carry a UUID `id` and an `order` field (the
      // builder tracks position as `sortOrder`). Omitting `id`/`order` 400s.
      questions: questions
        .filter((q) => q.text.trim())
        .map((q) => ({
          id: crypto.randomUUID(),
          type: q.type,
          text: q.text.trim(),
          required: q.required,
          order: q.sortOrder,
          options: ['single_choice', 'multi_choice'].includes(q.type)
            ? q.options.filter((o) => o.trim())
            : undefined,
          maxLength: q.type === 'text' ? q.maxLength : undefined,
        })),
    }
    createMut.mutate(body)
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => i < stepIndex && setStep(s.key)}
              className={`flex items-center gap-2 text-sm font-medium ${
                s.key === step
                  ? 'text-[var(--color-primary)]'
                  : i < stepIndex
                  ? 'text-[var(--color-text)] cursor-pointer hover:text-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] cursor-default'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  s.key === step
                    ? 'bg-[var(--color-primary)] text-white'
                    : i < stepIndex
                    ? 'bg-[var(--color-text)] text-[var(--color-surface)]'
                    : 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]'
                }`}
              >
                {i + 1}
              </span>
              {s.label}
            </Button>
            {i < STEPS.length - 1 && <span className="text-[var(--color-muted)]">&rsaquo;</span>}
          </div>
        ))}
      </div>

      {/* Step: Basics */}
      {step === 'basics' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Member Satisfaction Survey 2026"
              aria-describedby={errors.title ? 'title-error' : undefined}
              {...register('title')}
            />
            {errors.title && (
              <p id="title-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of what this survey is about..."
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Survey Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['nps', 'satisfaction', 'poll', 'custom'] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={formValues.surveyType === t ? 'outline' : 'ghost'}
                  onClick={() => setValue('surveyType', t)}
                  className={`p-2.5 text-sm ${
                    formValues.surveyType === t
                      ? 'border-[var(--color-primary)] bg-primary/5 font-medium'
                      : ''
                  }`}
                >
                  {SURVEY_TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="anonymous">Anonymous responses</Label>
              <p className="text-xs text-[var(--color-muted)]">
                Respondents&apos; identities will be hidden from results
              </p>
            </div>
            <Switch
              id="anonymous"
              checked={formValues.anonymous}
              onCheckedChange={(v) => setValue('anonymous', v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Deadline (optional)</Label>
            <DateTimePicker
              value={formValues.deadline ? new Date(formValues.deadline).toISOString() : undefined}
              onValueChange={(iso) => setValue('deadline', new Date(iso).toISOString())}
              placeholder="Select deadline"
            />
          </div>

          {/* Target Audience */}
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label>Target Audience (optional)</Label>
              <p className="text-xs text-[var(--color-muted)]">
                Leave empty to target all members
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target-tiers" className="text-xs">Membership Tiers</Label>
              <Input
                id="target-tiers"
                placeholder="e.g. Regular, Life, Associate (comma separated)"
                value={targetTiers.join(', ')}
                onChange={(e) => setTargetTiers(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target-chapters" className="text-xs">Chapters</Label>
              <Input
                id="target-chapters"
                placeholder="e.g. NCR, Region VII (comma separated)"
                value={targetChapters.join(', ')}
                onChange={(e) => setTargetChapters(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target-committees" className="text-xs">Committees</Label>
              <Input
                id="target-committees"
                placeholder="e.g. Education, Finance (comma separated)"
                value={targetCommittees.join(', ')}
                onChange={(e) => setTargetCommittees(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step: Questions */}
      {step === 'questions' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Questions</p>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Add questions and drag to reorder them
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {questions.map((q) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    onChange={(updated) => updateQuestion(q.id, updated)}
                    onDelete={() => deleteQuestion(q.id)}
                    canDelete={questions.length > 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button
            type="button"
            variant="link"
            onClick={addQuestion}
            className="text-[var(--color-primary)]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add question
          </Button>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">{formValues.title || 'Untitled Survey'}</h3>
            {formValues.description && (
              <p className="text-sm text-[var(--color-muted)]">{formValues.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-info-bg)] text-[var(--color-info)] font-medium">
                {SURVEY_TYPE_LABELS[formValues.surveyType]}
              </span>
              {formValues.anonymous && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                  Anonymous
                </span>
              )}
              {formValues.deadline && (
                <span className="text-[var(--color-muted)]">
                  Deadline:{' '}
                  {new Date(formValues.deadline).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
            {(targetTiers.length > 0 || targetChapters.length > 0 || targetCommittees.length > 0) && (
              <div className="border-t pt-3 mt-3 space-y-1 text-xs text-[var(--color-muted)]">
                <p className="font-medium text-[var(--color-text)]">Target Audience</p>
                {targetTiers.length > 0 && <p>Tiers: {targetTiers.join(', ')}</p>}
                {targetChapters.length > 0 && <p>Chapters: {targetChapters.join(', ')}</p>}
                {targetCommittees.length > 0 && <p>Committees: {targetCommittees.join(', ')}</p>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {questions.filter((q) => q.text.trim()).length} Question
              {questions.filter((q) => q.text.trim()).length !== 1 ? 's' : ''}
            </p>
            {questions
              .filter((q) => q.text.trim())
              .map((q, i) => (
                <div key={q.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--color-muted)]">Q{i + 1}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface-warm)] text-[var(--color-muted)]">
                      {q.type.replace('_', ' ')}
                    </span>
                    {q.required && (
                      <span className="text-xs text-[var(--color-error)]">Required</span>
                    )}
                  </div>
                  <p>{q.text}</p>
                  {['single_choice', 'multi_choice'].includes(q.type) &&
                    q.options.filter((o) => o.trim()).length > 0 && (
                      <ul className="mt-1 ml-4 list-disc text-xs text-[var(--color-muted)]">
                        {q.options
                          .filter((o) => o.trim())
                          .map((o, oi) => (
                            <li key={oi}>{o}</li>
                          ))}
                      </ul>
                    )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Survey Preview</DialogTitle>
          </DialogHeader>
          <SurveyFlow
            survey={{
              id: 'preview',
              title: formValues.title || 'Untitled Survey',
              description: formValues.description,
              surveyType: formValues.surveyType,
              settings: { anonymous: formValues.anonymous },
              questions: questions
                .filter((q) => q.text.trim())
                .map((q, i) => ({
                  id: q.id,
                  type: q.type,
                  text: q.text.trim(),
                  required: q.required,
                  order: i,
                  options: q.options,
                  maxLength: q.maxLength,
                })),
            }}
            previewMode
          />
        </DialogContent>
      </Dialog>

      {serverError && (
        <p role="alert" aria-live="polite" className="text-sm text-[var(--color-error)]">
          {serverError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(STEPS[stepIndex - 1]!.key)}
            >
              Back
            </Button>
          )}
          {step === 'review' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!questions.some((q) => q.text.trim())}
              className="gap-1.5"
            >
              <Eye size={16} />
              Preview as Member
            </Button>
          )}
          {stepIndex < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1]!.key)}
              disabled={!canProceed()}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => handleSubmit(submitForm)()}
              disabled={createMut.isPending || !formValues.title.trim()}
            >
              {createMut.isPending ? 'Creating...' : 'Create Survey'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
