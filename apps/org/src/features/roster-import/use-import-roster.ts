// apps/org/src/features/roster-import/use-import-roster.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importRosterMembers, type ImportMemberRow, type ImportResult } from '@monobase/sdk-ts/generated'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useImportRoster(orgId: string | null) {
  const qc = useQueryClient()
  return useMutation<ImportResult, Error, { tierId: string; members: ImportMemberRow[] }>({
    mutationFn: async ({ tierId, members }) => {
      if (!orgId) throw new Error('No organization selected.')
      // importRosterMembers returns a FLAT body ({imported,skipped,failed,errors}) — no {data} wrapper.
      const { data, error } = await importRosterMembers({
        body: { organizationId: orgId, tierId, members },
      })
      if (!data) throw new Error(serverError(error) ?? 'Roster import failed.')
      return data as ImportResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', orgId] })
    },
  })
}
