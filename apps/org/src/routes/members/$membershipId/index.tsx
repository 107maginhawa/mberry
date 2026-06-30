import { createFileRoute } from '@tanstack/react-router'
import { MemberDetail } from '@/features/member-detail/MemberDetail'

export const Route = createFileRoute('/members/$membershipId/')({
  component: MemberDetailPage,
})

function MemberDetailPage() {
  const { membershipId } = Route.useParams()
  return <MemberDetail membershipId={membershipId} />
}
