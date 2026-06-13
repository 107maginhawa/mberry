import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { DmList } from '@/features/comms/components/dm-list'
import { DmMemberPicker } from '@/features/comms/components/dm-member-picker'
import { ChatView } from '@/features/comms/components/chat-view'
import { useOrgProvider } from '@/providers/OrgProvider'
import { EmptyState } from '@/components/patterns/empty-state'
import { MessageCircle } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/messages/dm/')({
  component: DmIndexPage,
})

function DmIndexPage() {
  const { orgSlug } = Route.useParams()
  const { orgId } = useOrgProvider()
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const person = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    retry: false,
  })

  const myPersonId = person.data?.id ?? ''

  return (
    <PageShell
      title="Direct Messages"
      breadcrumbs={[
        { label: 'Messages', href: `/org/${orgSlug}/messages` },
        { label: 'Direct Messages' },
      ]}
    >
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* DM list sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto hidden md:block">
          <DmList
            orgId={orgId}
            activeRoomId={activeRoomId ?? undefined}
            onSelectRoom={setActiveRoomId}
            onNewDm={() => setPickerOpen(true)}
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
              orgId={orgId}
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

      <DmMemberPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        orgId={orgId}
        myPersonId={myPersonId}
        onCreated={(roomId) => {
          if (roomId) setActiveRoomId(roomId)
        }}
      />
    </PageShell>
  )
}
