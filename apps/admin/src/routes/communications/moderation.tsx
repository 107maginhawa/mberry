import { createFileRoute } from '@tanstack/react-router'
import { RequireRole } from '@/lib/role-gate'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { ShieldAlert, Check, AlertTriangle, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/communications/moderation')({
  component: ModerationQueue,
})

interface FlaggedItem {
  id: string
  type: 'feed_post' | 'chat_message'
  org: string
  author: string
  reason: string
  content: string
  reportCount: number
  reportedAt: string
}

// Placeholder data — will be fetched from API
const PLACEHOLDER_ITEMS: FlaggedItem[] = []

function ModerationQueue() {
  const items = PLACEHOLDER_ITEMS

  return (
    <RequireRole allowed={['super', 'support']}>
      <PageShell
        title="Moderation Queue"
        subtitle="Review reported content across all organizations"
        maxWidth="full"
      >
        <div className="space-y-6">
        {/* Filter tabs */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">All</Button>
          <Button variant="ghost" size="sm">Feed Posts</Button>
          <Button variant="ghost" size="sm">Chat Messages</Button>
          <Button variant="ghost" size="sm">Resolved</Button>
        </div>

        {/* Queue */}
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No flagged content in the queue</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {item.type === 'feed_post' ? 'Feed Post' : 'Chat Message'} — {item.org}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {item.reportCount} report{item.reportCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Author: {item.author} · Reason: {item.reason}
                  </p>
                  <div className="bg-muted/50 rounded p-3 text-sm">
                    {item.content}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Check className="h-3 w-3 mr-1" /> Dismiss
                    </Button>
                    <Button variant="outline" size="sm">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Warn Author
                    </Button>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </PageShell>
    </RequireRole>
  )
}
