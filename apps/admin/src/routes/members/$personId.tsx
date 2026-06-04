import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/react-query'
import { Mail, Phone, Globe, MapPin } from 'lucide-react'
import { Button } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'

export const Route = createFileRoute('/members/$personId')({
  component: MemberDetailPage,
})

const TABS = ['Profile', 'Credentials', 'Credits', 'Certificates', 'Privacy', 'Account'] as const
type Tab = (typeof TABS)[number]

function MemberDetailPage() {
  const { personId } = Route.useParams()

  return (
    <RequireRole allowed={['super', 'support', 'analyst']}>
      <MemberDetailContent personId={personId} />
    </RequireRole>
  )
}

function MemberDetailContent({ personId }: { personId: string }) {
  const { data: person, isLoading, isError } = useQuery({
    ...getPersonOptions({ path: { person: personId } }),
    retry: false,
  })

  if (isLoading) {
    return (
      <PageShell
        title="Loading…"
        breadcrumbs={[{ label: 'Members', href: '/members' }, { label: '…' }]}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-40 w-full bg-muted rounded" />
        </div>
      </PageShell>
    )
  }

  if (isError || !person) {
    return (
      <PageShell
        title="Member not found"
        breadcrumbs={[{ label: 'Members', href: '/members' }, { label: 'Not found' }]}
      >
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">Person not found or access denied.</p>
        </div>
      </PageShell>
    )
  }

  const p = person
  const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')

  return (
    <PageShell
      title={<span data-testid="member-name">{fullName}</span>}
      breadcrumbs={[
        { label: 'Members', href: '/members' },
        { label: fullName || 'Member' },
      ]}
      maxWidth="full"
      subtitle={
        <span className="flex items-center gap-4 text-sm text-muted-foreground">
          {p.contactInfo?.email && (
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> {p.contactInfo.email}
            </span>
          )}
          {p.licenseNumber && <span>License: {p.licenseNumber}</span>}
        </span>
      }
    >
      {/* Tabs */}
      <TabView person={p} />
    </PageShell>
  )
}

function TabView({ person }: { person: any }) {
  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b mb-6" data-testid="member-tabs">
        {TABS.map((tab, i) => (
          <Button
            key={tab}
            variant="ghost"
            size="sm"
            className={`rounded-none border-b-2 transition-colors ${
              i === 0
                ? 'border-purple-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            disabled={i > 0}
          >
            {tab}
          </Button>
        ))}
      </div>

      {/* Profile tab content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Info */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Personal Information</h3>
          <dl className="space-y-3 text-sm">
            <InfoRow label="First Name" value={person.firstName} />
            <InfoRow label="Last Name" value={person.lastName} />
            <InfoRow label="Middle Name" value={person.middleName} />
            <InfoRow label="Date of Birth" value={person.dateOfBirth} />
            <InfoRow label="Gender" value={person.gender} />
          </dl>
        </div>

        {/* Professional Info */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Professional Information</h3>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Specialization" value={person.specialization} />
            <InfoRow label="License Number" value={person.licenseNumber} />
            <InfoRow label="PRC ID" value={person.prcId} />
          </dl>
        </div>

        {/* Contact */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Contact</h3>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Email" value={person.contactInfo?.email} icon={<Mail className="w-3.5 h-3.5" />} />
            <InfoRow label="Phone" value={person.contactInfo?.phone} icon={<Phone className="w-3.5 h-3.5" />} />
            <InfoRow label="Timezone" value={person.timezone} icon={<Globe className="w-3.5 h-3.5" />} />
            <InfoRow label="Language" value={person.preferredLanguage} />
          </dl>
        </div>

        {/* Address */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Address</h3>
          {person.primaryAddress ? (
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {[
                person.primaryAddress.street1,
                person.primaryAddress.street2,
                person.primaryAddress.city,
                person.primaryAddress.state,
                person.primaryAddress.postalCode,
                person.primaryAddress.country,
              ].filter(Boolean).join(', ')}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No address on file</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-foreground">{value || '—'}</dd>
    </div>
  )
}
