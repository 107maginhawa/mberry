import { createFileRoute } from '@tanstack/react-router'
import { CategoryEditor } from '@/features/membership/components/category-editor'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/membership-categories')({
  component: CategoriesPage,
})

function CategoriesPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership Categories"
        subtitle="Define membership tiers and categories"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Categories' },
        ]}
      />
      <GlassCard className="p-6">
        <CategoryEditor orgId={orgId} />
      </GlassCard>
    </div>
  )
}
