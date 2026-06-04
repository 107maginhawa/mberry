import { createFileRoute } from '@tanstack/react-router'
import {
  ChangePasswordCard,
  // ProvidersCard,
  TwoFactorCard,
  PasskeysCard,
  // ApiKeysCard,
  SessionsCard,
  // DeleteAccountCard,
} from '@daveyplate/better-auth-ui'
import { requireAuth, requirePerson, composeGuards } from '@/utils/guards'
import { PageShell } from '@/components/patterns/page-shell'

export const Route = createFileRoute('/_authenticated/settings/security')({
  beforeLoad: composeGuards(requireAuth, requirePerson),
  component: SecuritySettingsPage,
})

function SecuritySettingsPage() {
  return (
    <PageShell
      title="Security Settings"
      subtitle="Manage your account security and monitor login activity"
    >
      <div className="flex flex-col gap-6">
        <ChangePasswordCard />
        {/* <ProvidersCard /> */}
        <TwoFactorCard />
        <PasskeysCard />
        {/* <ApiKeysCard /> */}
        <SessionsCard />
        {/* <DeleteAccountCard /> */}
      </div>
    </PageShell>
  )
}
