import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useState } from 'react'
import { MemberTable } from '@/features/membership/components/member-table'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { addRosterMemberMutation, getOrgCpdConfigOptions } from '@monobase/sdk-ts/generated/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/useOrg'

const STATUS_MAP: Record<string, string> = {
  active: 'active',
  grace: 'gracePeriod',
  gracePeriod: 'gracePeriod',
  lapsed: 'lapsed',
  suspended: 'suspended',
  pending: 'pendingPayment',
  pendingPayment: 'pendingPayment',
}

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/roster/')({
  component: RosterPage,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string | undefined),
    expiring: search.expiring ? Number(search.expiring) : undefined,
  }),
})

function RosterPage() {
  const { orgId, orgSlug } = useOrg()
  const { status, expiring } = Route.useSearch()
  const [showAdd, setShowAdd] = useState(false)

  const initialStatus = status ? (STATUS_MAP[status] ?? status) : undefined
  const { data: cpdConfig } = useQuery(getOrgCpdConfigOptions({ path: { organizationId: orgId } }))

  return (
    <PageShell
      title="Member Roster"
      subtitle="View and manage organization members"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Roster' },
      ]}
      actions={
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <UserPlus size={14} className="mr-1.5" />
          Add Member
        </Button>
      }
    >
      <div className="space-y-6">
        <MemberTable orgId={orgId} initialStatus={initialStatus} expiringDays={expiring} requiredCredits={cpdConfig?.data?.requiredCredits} />
        <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} orgId={orgId} />
      </div>
    </PageShell>
  )
}

const addMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  licenseNumber: z.string().optional(),
})

type AddMemberFormData = z.infer<typeof addMemberSchema>

function AddMemberDialog({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberFormData>({
    mode: 'onBlur',
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      licenseNumber: '',
    },
  })

  const addMemberMutOpts = addRosterMemberMutation()

  async function onSubmit(data: AddMemberFormData) {
    try {
      // First create person record via persons API (out of scope for SDK migration)
      const personData = await api.post<{ id?: string; data?: { id?: string } }>('/api/persons', {
        firstName: data.firstName.trim(),
        lastName: data.lastName?.trim(),
        contactInfo: { email: data.email.trim() },
      })
      const personId: string = personData.id ?? personData.data?.id ?? ''

      // Then add membership via SDK hook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (addMemberMutOpts.mutationFn as (args: unknown) => Promise<any>)({
        body: {
          personId,
          tierId: 'default',
          memberNumber: data.licenseNumber?.trim() || undefined,
        },
      })

      toast.success(`${data.firstName} ${data.lastName ?? ''}`.trim() + ' added as member')
      reset()
      onClose()
      // Reload page to show new member
      window.location.reload()
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || 'Failed to add member')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="Juan"
                  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p id="firstName-error" role="alert" className="text-xs text-[var(--color-error)]">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Cruz"
                  {...register('lastName')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-xs text-[var(--color-error)]">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="licenseNumber">License/Member Number</Label>
              <Input
                id="licenseNumber"
                placeholder="PRC-12345"
                {...register('licenseNumber')}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
