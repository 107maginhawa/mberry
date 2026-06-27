import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createOrganization } from '@monobase/sdk-ts/generated'
import type { CreateOrganizationResponse } from '@monobase/sdk-ts/generated'

export type CreateOrgInput = {
  associationId: string
  name: string
  orgType: string
  region?: string
  contactEmail?: string
}

export function useCreateOrg() {
  const qc = useQueryClient()
  const m = useMutation<CreateOrganizationResponse, Error, CreateOrgInput>({
    mutationFn: async (input: CreateOrgInput) => {
      const { data, error, response } = await createOrganization({
        body: {
          associationId: input.associationId,
          name: input.name,
          orgType: input.orgType as 'chapter' | 'society' | 'national' | 'clinic',
          ...(input.region ? { region: input.region } : {}),
          ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
        },
      })
      if (!data) {
        // SDK no-throw on non-2xx — surface the engine error string.
        // 403 uses { error: '...' }, 409/404/400 use { message: '...' }.
        const e = error as { error?: string; message?: string } | undefined
        const msg = e?.error ?? e?.message ?? `Create failed (${response?.status ?? '?'})`
        throw new Error(msg)
      }
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orgs'] })
    },
  })
  return {
    submit: m.mutateAsync,
    pending: m.isPending,
    error: m.error?.message ?? '',
  }
}
