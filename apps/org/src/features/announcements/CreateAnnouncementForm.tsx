import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Textarea } from '@monobase/ui'
import { useSelectedOrg } from '@/features/org/use-org'
import { useCreateAnnouncement } from './use-create-announcement'

export function CreateAnnouncementForm() {
  const { orgId } = useSelectedOrg()
  const create = useCreateAnnouncement(orgId)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const serverMessage = create.isError ? (create.error?.message ?? 'Could not post the announcement.') : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim(); const c = content.trim()
    if (!orgId || !t || !c) return
    create.mutate({ title: t, content: c }, {
      onSuccess: () => { toast.success('Announcement posted'); setTitle(''); setContent('') },
      onError: () => toast.error('Could not post the announcement'),
    })
  }

  return (
    <Card>
      <CardHeader><CardTitle>Post announcement</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-body text-muted-foreground">
          Posting announcements requires a President or Secretary with two-factor authentication enabled.
        </p>
        {!orgId && <p className="text-body text-muted-foreground">Select an organization first.</p>}
        {serverMessage && <p role="alert" className="mb-3 text-body text-destructive">{serverMessage}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label htmlFor="an-title">Title</Label><Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><Label htmlFor="an-content">Message</Label><Textarea id="an-content" value={content} onChange={(e) => setContent(e.target.value)} required /></div>
          <Button type="submit" disabled={!orgId || create.isPending} className="min-h-tap">
            {create.isPending ? 'Posting…' : 'Post announcement'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
