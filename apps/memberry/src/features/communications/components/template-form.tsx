import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { toast } from 'sonner'
import { TemplatePreview } from './template-preview'

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  channel: z.enum(['email', 'push', 'inApp']).default('email'),
  category: z.string().default('announcement'),
  subject: z.string().optional(),
  body: z.string().min(1, 'Body is required'),
  status: z.enum(['draft', 'active']).default('draft'),
})

type TemplateFormData = z.infer<typeof templateSchema>

const MERGE_FIELDS = [
  { label: 'Member Name', token: '{{member.name}}', key: 'member.name' },
  { label: 'Org Name', token: '{{org.name}}', key: 'org.name' },
  { label: 'Dues Amount', token: '{{member.duesAmount}}', key: 'member.duesAmount' },
  { label: 'Member Number', token: '{{member.memberNumber}}', key: 'member.memberNumber' },
] as const

interface ExistingTemplate {
  id: string
  name: string
  channel: string
  category: string
  subject?: string
  body: string
  mergeFields?: string[]
  status: string
}

interface TemplateFormProps {
  orgId: string
  existingTemplate?: ExistingTemplate
  onSuccess?: () => void
}

function extractMergeFields(text: string): string[] {
  const matches = text.match(/\{\{(\w+\.\w+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
}

export function TemplateForm({ orgId, existingTemplate, onSuccess }: TemplateFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TemplateFormData>({
    mode: 'onBlur',
    // biome-ignore lint: Zod v4 type incompatibility with @hookform/resolvers 5.2.2
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: existingTemplate?.name ?? '',
      channel: (existingTemplate?.channel as 'email' | 'push' | 'inApp') ?? 'email',
      category: existingTemplate?.category ?? 'announcement',
      subject: existingTemplate?.subject ?? '',
      body: existingTemplate?.body ?? '',
      status: (existingTemplate?.status as 'draft' | 'active') ?? 'draft',
    },
  })

  const bodyValue = watch('body')
  const subjectValue = watch('subject')
  const channelValue = watch('channel')
  const statusValue = watch('status')

  const { ref: bodyFormRef, ...bodyRest } = register('body')

  const setBodyRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      bodyFormRef(el)
      bodyRef.current = el
    },
    [bodyFormRef],
  )

  const insertMergeField = useCallback(
    (token: string) => {
      const el = bodyRef.current
      if (!el) {
        // Fallback: append
        setValue('body', (bodyValue ?? '') + token, { shouldDirty: true })
        return
      }
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? start
      const before = el.value.slice(0, start)
      const after = el.value.slice(end)
      const newValue = before + token + after
      setValue('body', newValue, { shouldDirty: true })
      // Move cursor after inserted token
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    },
    [bodyValue, setValue],
  )

  const mutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const mergeFields = extractMergeFields(data.body)
      const payload = {
        organizationId: orgId,
        name: data.name,
        channel: data.channel,
        category: data.category,
        subject: data.subject || undefined,
        body: data.body,
        mergeFields,
        status: data.status,
      }
      if (existingTemplate?.id) {
        return api.patch(`/api/association/message-templates/${existingTemplate.id}`, payload)
      }
      return api.post('/api/association/message-templates', payload)
    },
    onSuccess: () => {
      toast.success(existingTemplate ? 'Template updated' : 'Template created')
      onSuccess?.()
    },
    onError: (err: Error) => {
      setServerError(err.message)
      toast.error('Failed to save template')
    },
  })

  return (
    <div className="max-w-2xl space-y-6">
      {serverError && (
        <div role="alert" aria-live="polite" className="p-3 rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          {serverError}
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="template-name">Template Name</Label>
        <Input
          id="template-name"
          placeholder="e.g. Welcome Email"
          aria-describedby={errors.name ? 'name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="text-xs text-[var(--color-error)]">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Channel */}
      <div className="space-y-2">
        <Label>Channel</Label>
        <div className="flex gap-2">
          {(['email', 'push', 'inApp'] as const).map((ch) => (
            <Button
              key={ch}
              type="button"
              variant={channelValue === ch ? 'default' : 'outline'}
              onClick={() => setValue('channel', ch)}
            >
              {ch === 'inApp' ? 'In-App' : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="template-category">Category</Label>
        <Input
          id="template-category"
          placeholder="e.g. announcement, reminder, alert"
          {...register('category')}
        />
      </div>

      {/* Subject (email only) */}
      {channelValue === 'email' && (
        <div className="space-y-2">
          <Label htmlFor="template-subject">Subject</Label>
          <Input
            id="template-subject"
            placeholder="Email subject line"
            {...register('subject')}
          />
        </div>
      )}

      {/* Merge Field Toolbar */}
      <div className="space-y-2">
        <Label>Insert Merge Field</Label>
        <div className="flex flex-wrap gap-2">
          {MERGE_FIELDS.map((field) => (
            <Button
              key={field.key}
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => insertMergeField(field.token)}
            >
              {field.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2">
        <Label htmlFor="template-body">Body</Label>
        <Textarea
          id="template-body"
          placeholder="Write your template body here... Use merge fields like {{member.name}}"
          rows={8}
          className="resize-y font-mono text-sm"
          aria-describedby={errors.body ? 'body-error' : undefined}
          ref={setBodyRef}
          {...bodyRest}
        />
        {errors.body && (
          <p id="body-error" role="alert" className="text-xs text-[var(--color-error)]">
            {errors.body.message}
          </p>
        )}
      </div>

      {/* Status toggle */}
      <div className="space-y-2">
        <Label>Status</Label>
        <div className="flex gap-2 items-center">
          {(['draft', 'active'] as const).map((s) => (
            <Button
              key={s}
              type="button"
              variant={statusValue === s ? 'default' : 'outline'}
              onClick={() => setValue('status', s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
          <Badge variant={statusValue === 'active' ? 'default' : 'secondary'} className="ml-2">
            {statusValue}
          </Badge>
        </div>
      </div>

      {/* Preview */}
      {bodyValue && (
        <TemplatePreview body={bodyValue} subject={subjectValue} />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={handleSubmit((data) => {
            setServerError(null)
            mutation.mutate(data)
          })}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>
  )
}
