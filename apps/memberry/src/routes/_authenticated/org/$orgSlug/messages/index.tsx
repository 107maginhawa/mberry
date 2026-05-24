import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import { MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/messages/')({
  component: MessagesIndexPage,
})

function MessagesIndexPage() {
  return (
    <div className="flex-1 overflow-auto">
      <PageHeader title="Messages" />
      <div className="p-6">
        <EmptyState
          icon={<MessageSquare className="w-10 h-10" />}
          headline="Messages coming soon"
          description="Channels, direct messages, and real-time chat are being set up for your organization."
        />
      </div>
    </div>
  )
}
