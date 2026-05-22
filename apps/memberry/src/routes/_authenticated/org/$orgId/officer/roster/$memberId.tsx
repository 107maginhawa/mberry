import { createFileRoute } from '@tanstack/react-router'
import { MemberDetail } from '@/features/membership/components/member-detail'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/roster/$memberId')({
  component: MemberDetailPage,
})

function MemberDetailPage() {
  const { orgId, memberId } = Route.useParams()
  return <MemberDetail orgId={orgId} memberId={memberId} />
}
