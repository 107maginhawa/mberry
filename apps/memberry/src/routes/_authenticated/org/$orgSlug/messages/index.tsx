import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { ChannelList } from '@/features/comms/components/channel-list'
import { ChatView } from '@/features/comms/components/chat-view'
import { EmptyState } from '@/components/patterns/empty-state'
import { Button } from '@monobase/ui'
import { MessageSquare, MessageCircle } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/messages/')({
  component: MessagesIndexPage,
})

function MessagesIndexPage() {
  const { orgSlug } = Route.useParams()
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)

  const person = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    retry: false,
  })

  const myPersonId = person.data?.id ?? ''

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 pt-6">
        <PageHeader title="Messages" />
      </div>
      <div className="flex-1 flex gap-4 p-6 pt-2 overflow-hidden">
        {/* Sidebar: channels + DM link */}
        <div className="w-64 flex-shrink-0 overflow-y-auto hidden md:flex md:flex-col gap-3">
          <ChannelList
            orgSlug={orgSlug}
            activeRoomId={activeRoomId ?? undefined}
            onSelectRoom={setActiveRoomId}
          />
          <Link to={`/org/${orgSlug}/messages/dm` as any}>
            <Button variant="outline" className="w-full justify-start gap-2">
              <MessageCircle className="h-4 w-4" />
              Direct Messages
            </Button>
          </Link>
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0">
          {activeRoomId && myPersonId ? (
            <ChatView
              roomId={activeRoomId}
              myPersonId={myPersonId}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<MessageSquare className="w-10 h-10" />}
                headline="Select a conversation"
                description="Choose a channel from the sidebar or open your direct messages."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
