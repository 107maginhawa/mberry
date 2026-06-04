import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Button } from '@monobase/ui'
import {
  createInstitutionalMembershipMutation,
  updateInstitutionalMembershipMutation,
  listInstitutionalMembershipsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import type { InstitutionalMembership } from '@monobase/sdk-ts/generated/types.gen'

const institutionalMembershipSchema = z.object({
  parentOrganizationId: z.string().min(1, 'Parent organization ID is required'),
  tierId: z.string().min(1, 'Tier ID is required'),
  totalSeats: z.number().int().positive('Total seats must be a positive integer'),
  primaryContactId: z.string().min(1, 'Primary contact ID is required'),
  billingContactId: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  duesExpiryDate: z.string().min(1, 'Dues expiry date is required'),
})

type InstitutionalMembershipFormData = z.infer<typeof institutionalMembershipSchema>

function toDateInput(val: Date | string | undefined | null): string {
  if (!val) return ''
  const d = typeof val === 'string' ? new Date(val) : val
  return d.toISOString().slice(0, 10)
}

interface InstitutionalMembershipFormProps {
  orgId: string
  membership?: InstitutionalMembership
  onSuccess?: () => void
  onCancel?: () => void
}

export function InstitutionalMembershipForm({
  orgId,
  membership,
  onSuccess,
  onCancel,
}: InstitutionalMembershipFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!membership

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InstitutionalMembershipFormData>({
    mode: 'onBlur',
    resolver: zodResolver(institutionalMembershipSchema),
    defaultValues: {
      parentOrganizationId: membership?.parentOrganizationId ?? '',
      tierId: membership?.tierId ?? '',
      totalSeats: membership?.totalSeats ?? 1,
      primaryContactId: membership?.primaryContactId ?? '',
      billingContactId: membership?.billingContactId ?? '',
      startDate: toDateInput(membership?.startDate),
      duesExpiryDate: toDateInput(membership?.duesExpiryDate),
    },
  })

  const createMutOpts = createInstitutionalMembershipMutation()
  const createMut = useMutation({
    mutationFn: createMutOpts.mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listInstitutionalMembershipsQueryKey({ query: { organizationId: orgId } }) })
      toast.success('Institutional membership created')
      onSuccess?.()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create membership'),
  })

  const updateMutOpts = updateInstitutionalMembershipMutation()
  const updateMut = useMutation({
    mutationFn: updateMutOpts.mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listInstitutionalMembershipsQueryKey({ query: { organizationId: orgId } }) })
      toast.success('Institutional membership updated')
      onSuccess?.()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update membership'),
  })

  const serverError = isEdit
    ? (updateMut.error as Error | null)?.message ?? null
    : (createMut.error as Error | null)?.message ?? null

  function onSubmit(data: InstitutionalMembershipFormData) {
    const body = {
      organizationId: orgId,
      parentOrganizationId: data.parentOrganizationId,
      tierId: data.tierId,
      totalSeats: data.totalSeats,
      primaryContactId: data.primaryContactId,
      billingContactId: data.billingContactId || undefined,
      startDate: new Date(data.startDate),
      duesExpiryDate: new Date(data.duesExpiryDate),
    }

    if (isEdit) {
      updateMut.mutate({ path: { institutionalMembershipId: membership!.id }, body })
    } else {
      createMut.mutate({ body })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div role="alert" aria-live="polite" className="p-3 rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          {serverError}
        </div>
      )}

      {/* Org Info */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">Organization</h3>
        <div className="space-y-1.5">
          <Label htmlFor="parentOrganizationId">Parent Organization ID *</Label>
          <Input
            id="parentOrganizationId"
            placeholder="UUID of the parent association"
            aria-describedby={errors.parentOrganizationId ? 'parentOrgId-error' : undefined}
            {...register('parentOrganizationId')}
          />
          {errors.parentOrganizationId && (
            <p id="parentOrgId-error" role="alert" className="text-xs text-[var(--color-error)]">
              {errors.parentOrganizationId.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tierId">Tier ID *</Label>
          <Input
            id="tierId"
            placeholder="Membership tier ID"
            aria-describedby={errors.tierId ? 'tierId-error' : undefined}
            {...register('tierId')}
          />
          {errors.tierId && (
            <p id="tierId-error" role="alert" className="text-xs text-[var(--color-error)]">
              {errors.tierId.message}
            </p>
          )}
        </div>
      </div>

      {/* Seats & Contacts */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">Seats & Contacts</h3>
        <div className="space-y-1.5">
          <Label htmlFor="totalSeats">Total Seats *</Label>
          <Input
            id="totalSeats"
            type="number"
            min={1}
            placeholder="10"
            aria-describedby={errors.totalSeats ? 'totalSeats-error' : undefined}
            {...register('totalSeats', { valueAsNumber: true })}
          />
          {errors.totalSeats && (
            <p id="totalSeats-error" role="alert" className="text-xs text-[var(--color-error)]">
              {errors.totalSeats.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="primaryContactId">Primary Contact ID *</Label>
          <Input
            id="primaryContactId"
            placeholder="Person UUID"
            aria-describedby={errors.primaryContactId ? 'primaryContactId-error' : undefined}
            {...register('primaryContactId')}
          />
          {errors.primaryContactId && (
            <p id="primaryContactId-error" role="alert" className="text-xs text-[var(--color-error)]">
              {errors.primaryContactId.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billingContactId">Billing Contact ID</Label>
          <Input
            id="billingContactId"
            placeholder="Person UUID (optional)"
            {...register('billingContactId')}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              aria-describedby={errors.startDate ? 'startDate-error' : undefined}
              {...register('startDate')}
            />
            {errors.startDate && (
              <p id="startDate-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.startDate.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duesExpiryDate">Dues Expiry Date *</Label>
            <Input
              id="duesExpiryDate"
              type="date"
              aria-describedby={errors.duesExpiryDate ? 'duesExpiryDate-error' : undefined}
              {...register('duesExpiryDate')}
            />
            {errors.duesExpiryDate && (
              <p id="duesExpiryDate-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.duesExpiryDate.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit ? 'Saving...' : 'Creating...'
            : isEdit ? 'Update Membership' : 'Create Membership'
          }
        </Button>
      </div>
    </form>
  )
}
