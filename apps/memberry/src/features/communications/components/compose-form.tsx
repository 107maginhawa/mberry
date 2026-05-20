import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { Textarea } from '@monobase/ui'

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

type FormAction = 'draft' | 'sent' | 'scheduled'

export function ComposeForm({ orgId, existingAnnouncement }: ComposeFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState(existingAnnouncement?.title ?? '')
  const [content, setContent] = useState(existingAnnouncement?.content ?? '')
  const [audienceType, setAudienceType] = useState(existingAnnouncement?.audienceType ?? 'all')
  const [channelPush, setChannelPush] = useState(existingAnnouncement?.channelPush ?? true)
  const [channelEmail, setChannelEmail] = useState(existingAnnouncement?.channelEmail ?? false)
  const [visibility, setVisibility] = useState(existingAnnouncement?.visibility ?? 'internal')
  const [scheduledAt, setScheduledAt] = useState(existingAnnouncement?.scheduledAt ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (action: FormAction) => {
      const body = {
        title,
        content,
        audienceType,
        channelPush,
        channelEmail,
        visibility,
        status: action,
        scheduledAt: action === 'scheduled' && scheduledAt ? scheduledAt : undefined,
      }
      if (existingAnnouncement?.id) {
        return api.patch(`/api/communications/announcements/${existingAnnouncement.id}`, body)
      }
      return api.post(`/api/communications/announcements/${orgId}`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', orgId] })
      navigate({ to: `/org/${orgId}/officer/communications` })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = (action: FormAction) => {
    setError(null)
    if (!title.trim()) { setError('Title is required'); return }
    if (!content.trim()) { setError('Content is required'); return }
    mutation.mutate(action)
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">{error}</div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="Announcement title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <p className="text-xs text-[var(--color-muted)] text-right">{title.length}/200</p>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Message</Label>
        <Textarea
          id="content"
          placeholder="Write your announcement here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="resize-y"
        />
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
              onClick={() => setAudienceType(type)}
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
            <Switch checked={channelPush} onCheckedChange={setChannelPush} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-[var(--color-muted)]">Send via transactional email</p>
            </div>
            <Switch checked={channelEmail} onCheckedChange={setChannelEmail} />
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
              onClick={() => setVisibility(vis)}
            >
              {vis === 'internal' ? 'Internal (Members Only)' : 'Network (Public)'}
            </Button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-2">
        <Label htmlFor="scheduledAt">Schedule (optional)</Label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <p className="text-xs text-[var(--color-muted)]">Leave empty to send immediately or save as draft</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={() => handleSubmit('sent')}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Sending...' : 'Send Now'}
        </Button>
        {scheduledAt && (
          <Button
            type="button"
            onClick={() => handleSubmit('scheduled')}
            disabled={mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Schedule
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit('draft')}
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
