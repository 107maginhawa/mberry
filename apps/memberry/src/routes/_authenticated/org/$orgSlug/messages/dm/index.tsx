import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { DmList } from '@/features/comms/components/dm-list'
import { ChatView } from '@/features/comms/components/chat-view'
import { EmptyState } from '@/components/patterns/empty-state'
import { MessageCircle } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/messages/dm/')({
  component: DmIndexPage,
})

function DmIndexPage() {
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
        <PageHeader
          title="Direct Messages"
          breadcrumbs={[
            { label: 'Messages', href: `/org/${orgSlug}/messages` },
            { label: 'Direct Messages' },
          ]}
        />
      </div>
      <div className="flex-1 flex gap-4 p-6 pt-2 overflow-hidden">
        {/* DM list sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto hidden md:block">
          <DmList
            activeRoomId={activeRoomId ?? undefined}
            onSelectRoom={setActiveRoomId}
            myPersonId={myPersonId}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0">
          {activeRoomId && myPersonId ? (
            <ChatView
              roomId={activeRoomId}
              myPersonId={myPersonId}
              roomName="Direct Message"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<MessageCircle className="w-10 h-10" />}
                headline="Select a conversation"
                description="Choose a direct message from the sidebar, or start a new one."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
