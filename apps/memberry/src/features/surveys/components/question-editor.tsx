import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button, Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type QuestionType = 'nps' | 'rating' | 'single_choice' | 'multi_choice' | 'text' | 'yes_no'

export interface SurveyQuestion {
  id: string
  type: QuestionType
  text: string
  required: boolean
  options: string[]
  maxLength?: number
  sortOrder: number
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  nps: 'NPS (0-10)',
  rating: 'Rating (1-5)',
  single_choice: 'Single Choice',
  multi_choice: 'Multiple Choice',
  text: 'Free Text',
  yes_no: 'Yes / No',
}

const CHOICE_TYPES: QuestionType[] = ['single_choice', 'multi_choice']

interface QuestionEditorProps {
  question: SurveyQuestion
  onChange: (updated: SurveyQuestion) => void
  onDelete: () => void
  canDelete: boolean
}

export function QuestionEditor({ question, onChange, onDelete, canDelete }: QuestionEditorProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function updateField<K extends keyof SurveyQuestion>(key: K, value: SurveyQuestion[K]) {
    onChange({ ...question, [key]: value })
  }

  function addOption() {
    onChange({ ...question, options: [...question.options, ''] })
  }

  function updateOption(index: number, value: string) {
    const next = [...question.options]
    next[index] = value
    onChange({ ...question, options: next })
  }

  function removeOption(index: number) {
    onChange({ ...question, options: question.options.filter((_, i) => i !== index) })
  }

  const isChoiceType = CHOICE_TYPES.includes(question.type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-[var(--color-surface)] p-4 space-y-3"
    >
      {/* Header with drag handle */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="cursor-grab touch-none text-[var(--color-muted)] hover:text-[var(--color-text)]"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </Button>

        <div className="flex-1">
          <Select
            value={question.type}
            onValueChange={(v) => updateField('type', v as QuestionType)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor={`required-${question.id}`} className="text-xs text-[var(--color-muted)]">
            Required
          </Label>
          <Switch
            id={`required-${question.id}`}
            checked={question.required}
            onCheckedChange={(v) => updateField('required', v)}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={!canDelete}
          className="text-[var(--color-muted)] hover:text-[var(--color-error)]"
          aria-label="Delete question"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Question text */}
      <Input
        value={question.text}
        onChange={(e) => updateField('text', e.target.value)}
        placeholder="Enter your question..."
        className="font-medium"
      />

      {/* Options for choice types */}
      {isChoiceType && (
        <div className="space-y-2 pl-6">
          <p className="text-xs text-[var(--color-muted)]">Options</p>
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-muted)] w-5 text-right">{i + 1}.</span>
              <Input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOption(i)}
                disabled={question.options.length <= 2}
                className="text-[var(--color-muted)] hover:text-[var(--color-error)]"
                aria-label="Remove option"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="link"
            onClick={addOption}
            className="text-[var(--color-primary)] text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add option
          </Button>
        </div>
      )}

      {/* Max length for text type */}
      {question.type === 'text' && (
        <div className="pl-6 space-y-1">
          <Label className="text-xs">Max length (optional)</Label>
          <Input
            type="number"
            min="1"
            max="5000"
            value={question.maxLength ?? ''}
            onChange={(e) => updateField('maxLength', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="e.g. 500"
            className="w-32"
          />
        </div>
      )}
    </div>
  )
}
