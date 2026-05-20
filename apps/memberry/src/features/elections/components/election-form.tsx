import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button, Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import {
  createElectionMutation,
  updateElectionMutation,
  listElectionsQueryKey,
  getElectionOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { ElectionCreateRequest, ElectionType } from '@monobase/sdk-ts/generated/types.gen'

const electionBasicsSchema = z.object({
  title: z.string().min(1, 'Election title is required'),
  type: z.enum(['officer', 'bylaw']),
  votingMode: z.enum(['online', 'in_person', 'hybrid']),
  passageThreshold: z.string().optional(),
  nominationsOpenAt: z.string().optional(),
  nominationsCloseAt: z.string().optional(),
  votingOpenAt: z.string().optional(),
  votingCloseAt: z.string().optional(),
})

type ElectionBasicsFormData = z.infer<typeof electionBasicsSchema>

interface Position {
  id: string
  title: string
  sortOrder: number
}

interface ElectionInitialData {
  title: string
  type: 'officer' | 'bylaw'
  votingMode: 'online' | 'in_person' | 'hybrid'
  passageThreshold?: string
  nominationsOpenAt?: string
  nominationsCloseAt?: string
  votingOpenAt?: string
  votingCloseAt?: string
  positions: Position[]
}

interface ElectionFormProps {
  orgId: string
  electionId?: string
  initialData?: ElectionInitialData
  onSuccess?: (election: unknown) => void
  onCancel?: () => void
}

type Step = 'basics' | 'positions' | 'timeline'

const STEPS: { key: Step; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'positions', label: 'Positions' },
  { key: 'timeline', label: 'Timeline' },
]

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function ElectionForm({ orgId, electionId, initialData, onSuccess, onCancel }: ElectionFormProps) {
  const isEdit = !!electionId && !!initialData
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('basics')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ElectionBasicsFormData>({
    resolver: zodResolver(electionBasicsSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      type: initialData?.type ?? 'officer',
      votingMode: initialData?.votingMode ?? 'online',
      passageThreshold: initialData?.passageThreshold ?? '',
      nominationsOpenAt: initialData?.nominationsOpenAt ?? '',
      nominationsCloseAt: initialData?.nominationsCloseAt ?? '',
      votingOpenAt: initialData?.votingOpenAt ?? '',
      votingCloseAt: initialData?.votingCloseAt ?? '',
    },
  })

  const formType = watch('type')
  const formVotingMode = watch('votingMode')
  const formTitle = watch('title')

  const [positions, setPositions] = useState<Position[]>(
    initialData?.positions?.length ? initialData.positions : [{ id: generateId(), title: '', sortOrder: 0 }],
  )

  function addPosition() {
    setPositions((prev) => [
      ...prev,
      { id: generateId(), title: '', sortOrder: prev.length },
    ])
  }

  function removePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i })))
  }

  function updatePositionTitle(id: string, title: string) {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)))
  }

  const createMut = useMutation({
    mutationFn: createElectionMutation().mutationFn,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: listElectionsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
    onError: (err: Error) => {
      setServerError(err.message)
    },
  })

  const updateMut = useMutation({
    mutationFn: updateElectionMutation().mutationFn,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: listElectionsQueryKey({ query: { organizationId: orgId } }) })
      if (electionId) {
        queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
      }
      onSuccess?.(data)
    },
    onError: (err: Error) => {
      setServerError(err.message)
    },
  })

  const mutation = isEdit ? updateMut : createMut

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  function canProceed() {
    if (step === 'basics') return formTitle.trim().length > 0
    if (step === 'positions') return positions.some((p) => p.title.trim().length > 0)
    return true
  }

  function submitForm(data: ElectionBasicsFormData) {
    const body: ElectionCreateRequest = {
      organizationId: orgId,
      title: data.title,
      // Form uses 'bylaw'/'officer'; API uses ElectionType union — map to nearest value
      electionType: (data.type === 'bylaw' ? 'special' : 'general') as ElectionType,
      positions: positions.filter((p) => p.title.trim()).map((p) => p.title.trim()),
      nominationStart: data.nominationsOpenAt ? new Date(data.nominationsOpenAt) : new Date(),
      nominationEnd: data.nominationsCloseAt ? new Date(data.nominationsCloseAt) : new Date(),
      votingStart: data.votingOpenAt ? new Date(data.votingOpenAt) : new Date(),
      votingEnd: data.votingCloseAt ? new Date(data.votingCloseAt) : new Date(),
      ...(data.type === 'bylaw' && data.passageThreshold ? { quorumRequired: parseInt(data.passageThreshold, 10) } : {}),
    }
    if (isEdit) {
      updateMut.mutate({ path: { electionId: electionId! }, body })
    } else {
      createMut.mutate({ body })
    }
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
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                s.key === step
                  ? 'bg-[var(--color-primary)] text-white'
                  : i < stepIndex
                  ? 'bg-[var(--color-text)] text-[var(--color-surface)]'
                  : 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]'
              }`}>
                {i + 1}
              </span>
              {s.label}
            </Button>
            {i < STEPS.length - 1 && <span className="text-[var(--color-muted)]">›</span>}
          </div>
        ))}
      </div>

      {/* Step: Basics */}
      {step === 'basics' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Election Title</Label>
            <Input
              id="title"
              placeholder="e.g. 2025 Board of Directors Election"
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
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['officer', 'bylaw'] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={formType === t ? 'outline' : 'ghost'}
                  onClick={() => setValue('type', t)}
                  className={`h-auto p-3 flex-col items-start text-left ${
                    formType === t ? 'border-[var(--color-primary)] bg-primary/5' : ''
                  }`}
                >
                  <p className="font-medium capitalize">{t}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 font-normal">
                    {t === 'officer' ? 'Elect officers to positions' : 'Vote on bylaw amendments'}
                  </p>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Voting Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['online', 'in_person', 'hybrid'] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={formVotingMode === m ? 'outline' : 'ghost'}
                  onClick={() => setValue('votingMode', m)}
                  className={`p-2.5 text-sm capitalize ${
                    formVotingMode === m ? 'border-[var(--color-primary)] bg-primary/5 font-medium' : ''
                  }`}
                >
                  {m.replace('_', '-')}
                </Button>
              ))}
            </div>
          </div>

          {formType === 'bylaw' && (
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Passage Threshold (%)</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                placeholder="e.g. 67"
                {...register('passageThreshold')}
              />
              <p className="text-xs text-[var(--color-muted)]">Percentage of votes needed to pass (e.g. 67 for two-thirds majority)</p>
            </div>
          )}
        </div>
      )}

      {/* Step: Positions */}
      {step === 'positions' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Positions</p>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {formType === 'officer' ? 'Add the officer positions to be elected' : 'Add the bylaw items to be voted on'}
            </p>
          </div>

          <div className="space-y-2">
            {positions.map((pos, i) => (
              <div key={pos.id} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-[var(--color-muted)] shrink-0 cursor-grab" />
                <Input
                  value={pos.title}
                  onChange={(e) => updatePositionTitle(pos.id, e.target.value)}
                  placeholder={formType === 'officer' ? `e.g. President` : `e.g. Amendment ${i + 1}`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePosition(pos.id)}
                  disabled={positions.length === 1}
                  className="text-[var(--color-muted)] hover:text-[var(--color-error)]"
                  aria-label="Remove position"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="link"
            onClick={addPosition}
            className="text-[var(--color-primary)]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add position
          </Button>
        </div>
      )}

      {/* Step: Timeline */}
      {step === 'timeline' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-muted)]">All dates are optional. You can set them later.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nom-open">Nominations Open</Label>
              <Input
                id="nom-open"
                type="datetime-local"
                {...register('nominationsOpenAt')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nom-close">Nominations Close</Label>
              <Input
                id="nom-close"
                type="datetime-local"
                {...register('nominationsCloseAt')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vote-open">Voting Opens</Label>
              <Input
                id="vote-open"
                type="datetime-local"
                {...register('votingOpenAt')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vote-close">Voting Closes</Label>
              <Input
                id="vote-close"
                type="datetime-local"
                {...register('votingCloseAt')}
              />
            </div>
          </div>
        </div>
      )}

      {serverError && (
        <p role="alert" aria-live="polite" className="text-sm text-[var(--color-error)]">{serverError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
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
              disabled={mutation.isPending || !formTitle.trim()}
            >
              {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Save as Draft'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
