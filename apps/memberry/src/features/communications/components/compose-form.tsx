import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { DateTimePicker } from '@/components/patterns/date-picker'

const composeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  content: z.string().min(1, 'Content is required'),
  audienceType: z.enum(['all', 'by_category']).default('all'),
  channelPush: z.boolean().default(true),
  channelEmail: z.boolean().default(false),
  visibility: z.enum(['internal', 'network']).default('internal'),
  scheduledAt: z.string().optional(),
})

type ComposeFormData = z.infer<typeof composeSchema>

type FormAction = 'draft' | 'sent' | 'scheduled'

interface ComposeFormProps {
  orgId: string
  existingAnnouncement?: {
    id: string
    title: string
    content: string
    audienceType: string
    audienceCategories?: string[] | null
    channelPush: boolean
    channelEmail: boolean
    visibility: string
    scheduledAt?: string | null
  }
}

export function ComposeForm({ orgId, existingAnnouncement }: ComposeFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ComposeFormData>({
    mode: 'onBlur',
    // biome-ignore lint: Zod v4 type incompatibility with @hookform/resolvers 5.2.2
    resolver: zodResolver(composeSchema),
    defaultValues: {
      title: existingAnnouncement?.title ?? '',
      content: existingAnnouncement?.content ?? '',
      audienceType: (existingAnnouncement?.audienceType as 'all' | 'by_category') ?? 'all',
      channelPush: existingAnnouncement?.channelPush ?? true,
      channelEmail: existingAnnouncement?.channelEmail ?? false,
      visibility: (existingAnnouncement?.visibility as 'internal' | 'network') ?? 'internal',
      scheduledAt: existingAnnouncement?.scheduledAt ?? '',
    },
  })

  const titleValue = watch('title')
  const audienceType = watch('audienceType')
  const channelPush = watch('channelPush')
  const channelEmail = watch('channelEmail')
  const visibility = watch('visibility')
  const scheduledAt = watch('scheduledAt')

  const mutation = useMutation({
    mutationFn: async (action: FormAction) => {
      const data = {
        title: titleValue,
        content: watch('content'),
        audienceType,
        channelPush,
        channelEmail,
        visibility,
        status: action,
        scheduledAt: action === 'scheduled' && scheduledAt ? scheduledAt : undefined,
      }
      if (existingAnnouncement?.id) {
        return api.patch(`/api/communications/announcements/${existingAnnouncement.id}`, data)
      }
      return api.post(`/api/communications/announcements/${orgId}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', orgId] })
      navigate({ to: `/org/${orgId}/officer/communications` })
    },
    onError: (err: Error) => {
      setServerError(err.message)
    },
  })

  function submitWithAction(action: FormAction) {
    return handleSubmit(() => {
      setServerError(null)
      mutation.mutate(action)
    })()
  }

  return (
    <div className="max-w-2xl space-y-6">
      {serverError && (
        <div role="alert" aria-live="polite" className="p-3 rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">{serverError}</div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="Announcement title"
          maxLength={200}
          aria-describedby={errors.title ? 'title-error' : 'title-count'}
          {...register('title')}
        />
        {errors.title ? (
          <p id="title-error" role="alert" className="text-xs text-[var(--color-error)]">
            {errors.title.message}
          </p>
        ) : (
          <p id="title-count" className="text-xs text-[var(--color-muted)] text-right">{titleValue.length}/200</p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Message</Label>
        <Textarea
          id="content"
          placeholder="Write your announcement here..."
          rows={8}
          className="resize-y"
          aria-describedby={errors.content ? 'content-error' : undefined}
          {...register('content')}
        />
        {errors.content && (
          <p id="content-error" role="alert" className="text-xs text-[var(--color-error)]">
            {errors.content.message}
          </p>
        )}
      </div>

      {/* Audience */}
      <div className="space-y-2">
        <Label>Audience</Label>
        <div className="flex gap-3">
          {(['all', 'by_category'] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant={audienceType === type ? 'default' : 'outline'}
              onClick={() => setValue('audienceType', type)}
            >
              {type === 'all' ? 'All Members' : 'By Category'}
            </Button>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        <Label>Channels</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Push Notification</p>
              <p className="text-xs text-[var(--color-muted)]">Send to member devices via OneSignal</p>
            </div>
            <Switch checked={channelPush} onCheckedChange={(v) => setValue('channelPush', v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-[var(--color-muted)]">Send via transactional email</p>
            </div>
            <Switch checked={channelEmail} onCheckedChange={(v) => setValue('channelEmail', v)} />
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label>Visibility</Label>
        <div className="flex gap-3">
          {(['internal', 'network'] as const).map((vis) => (
            <Button
              key={vis}
              type="button"
              variant={visibility === vis ? 'default' : 'outline'}
              onClick={() => setValue('visibility', vis)}
            >
              {vis === 'internal' ? 'Internal (Members Only)' : 'Network (Public)'}
            </Button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-2">
        <Label>Schedule (optional)</Label>
        <Controller
          name="scheduledAt"
          control={control}
          render={({ field }) => (
            <DateTimePicker
              value={field.value ? new Date(field.value).toISOString() : undefined}
              onValueChange={(iso) => field.onChange(iso)}
              placeholder="Select schedule date & time"
            />
          )}
        />
        <p className="text-xs text-[var(--color-muted)]">Leave empty to send immediately or save as draft</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={() => submitWithAction('sent')}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Sending...' : 'Send Now'}
        </Button>
        {scheduledAt && (
          <Button
            type="button"
            onClick={() => submitWithAction('scheduled')}
            disabled={mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Schedule
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => submitWithAction('draft')}
          disabled={mutation.isPending}
        >
          Save Draft
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate({ to: `/org/${orgId}/officer/communications` })}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
