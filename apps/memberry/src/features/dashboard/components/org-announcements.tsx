import { Megaphone } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { GlassCard } from '@/components/motion/glass-card'

interface OrgAnnouncementsProps {
  announcements: Array<{ id: string; title: string; subject?: string; content?: string; createdAt?: string; organizationId?: string }>
  orgNames: Record<string, string>
  isError?: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function OrgAnnouncements({ announcements, orgNames, isError }: OrgAnnouncementsProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
        <h3 className="text-h4">Org News</h3>
      </div>

      {isError ? (
        <p className="text-[13px] text-red-600">Unable to load announcements</p>
      ) : announcements.length === 0 ? (
        <EmptyState
          headline="No recent announcements"
          description="News from your organizations will appear here"
        />
      ) : (
        <div className="space-y-1">
          {announcements.slice(0, 5).map((a) => (
            <div
              key={a.id}
              className="py-2.5 px-2 rounded-lg"
            >
              <p className="text-[13px] font-semibold line-clamp-1">{a.subject || a.title}</p>
              {a.content && (
                <p className="text-[12px] text-[var(--color-muted)] line-clamp-1 mt-0.5">
                  {a.content.replace(/<[^>]*>/g, '').slice(0, 120)}
                </p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                {a.organizationId && orgNames[a.organizationId] && (
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {orgNames[a.organizationId]}
                  </span>
                )}
                {a.createdAt && (
                  <>
                    <span className="text-[11px] text-[var(--color-muted)]">·</span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {formatDate(a.createdAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
