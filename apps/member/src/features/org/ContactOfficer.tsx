import { useMemberOrgProfile } from './use-member-org-profile'

/**
 * ContactOfficer — turns the dead-end "contact your chapter officer" text into
 * actionable tel:/mailto: links, so an older member never has to go hunt for a
 * phone number the app already knows.
 *
 * Renders nothing when no contact channel is known (graceful — no worse than the
 * old static text). a11y: each link is a ≥48px target with a text label
 * (DESIGN.md: text label on every icon, no icon-only controls).
 */
export function ContactOfficer() {
  const { data } = useMemberOrgProfile()
  if (!data || (!data.contactEmail && !data.phone)) return null

  const linkClass =
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-body font-medium text-primary'

  return (
    <section aria-label="Contact your chapter" className="space-y-3 rounded-lg border border-border bg-[var(--color-surface-warm)] p-4">
      <p className="text-body text-muted-foreground">
        Need help? Contact <span className="font-medium text-foreground">{data.name}</span>.
      </p>
      <div className="flex flex-col gap-2">
        {data.phone && (
          <a href={`tel:${data.phone.replace(/[^\d+]/g, '')}`} className={linkClass}>
            Call {data.phone}
          </a>
        )}
        {data.contactEmail && (
          <a href={`mailto:${data.contactEmail}`} className={linkClass}>
            Email {data.contactEmail}
          </a>
        )}
      </div>
    </section>
  )
}
