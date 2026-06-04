/**
 * Notification Preferences page — member-facing toggle matrix.
 * VS-031: Wave 4b Communications.
 */

import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { NotificationPreferences } from '@/features/communications/components/notification-preferences'
import { useOrgContext } from '@/hooks/useOrgContext'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/my-notifications')({
  component: MyNotificationsPage,
})

function MyNotificationsPage() {
  const { orgId } = useOrgContext()

  // personId: we use 'me' as a sentinel — the API resolves it server-side
  const personId = 'me'

  return (
    <PageShell
      title="Notification Preferences"
      subtitle="Choose how you want to be notified for each category"
    >
      <div className="space-y-6 max-w-3xl">
        {orgId ? (
          <NotificationPreferences orgId={orgId} personId={personId} />
        ) : (
          <p className="text-[14px] text-[var(--color-muted)]">Loading...</p>
        )}
      </div>
    </PageShell>
  )
}
