import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import { MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/messages/')({
  component: OfficerMessagesPage,
})

function OfficerMessagesPage() {
  return (
    <div className="flex-1 overflow-auto">
      <PageHeader title="Channels" />
      <div className="p-6">
        <EmptyState
          icon={<MessageSquare className="w-10 h-10" />}
          headline="Channel management coming soon"
          description="Create and manage channels for your organization's communication."
        />
      </div>
    </div>
  )
}
