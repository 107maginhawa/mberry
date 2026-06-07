import { createFileRoute } from '@tanstack/react-router'
import { CategoryEditor } from '@/features/membership/components/category-editor'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/membership-categories')({
  component: CategoriesPage,
})

function CategoriesPage() {
  const { orgId, orgSlug } = useOrg()
  return (
    <PageShell
      title="Membership Categories"
      subtitle="Define membership tiers and categories"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Settings' },
        { label: 'Categories' },
      ]}
    >
      <GlassCard className="p-6">
        <CategoryEditor orgId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
