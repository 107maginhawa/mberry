import { createFileRoute } from '@tanstack/react-router'
import { MemberDetail } from '@/features/membership/components/member-detail'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/roster/$memberId')({
  component: MemberDetailPage,
})

function MemberDetailPage() {
  const { orgId } = useOrg()
  const { memberId } = Route.useParams()
  return <MemberDetail orgId={orgId} memberId={memberId} />
}
