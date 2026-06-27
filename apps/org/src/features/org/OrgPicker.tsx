import { useOrgs, useSelectedOrg } from './use-org'

/**
 * OrgPicker — labeled <select> listing the officer's orgs.
 * Only rendered when orgs.length > 1 (caller's responsibility).
 * min-h-tap ensures ≥48px touch target per DESIGN.md accessibility baseline.
 */
export function OrgPicker() {
  const { orgs } = useOrgs()
  const { orgId, setOrgId } = useSelectedOrg()

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-plum-700">Organisation</span>
      <select
        className="min-h-tap rounded border border-plum-200 bg-white px-3 py-2 text-base text-plum-900"
        value={orgId ?? ''}
        onChange={(e) => setOrgId(e.target.value)}
        aria-label="Select organisation"
      >
        <option value="" disabled>Select an organisation…</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>{org.name}</option>
        ))}
      </select>
    </label>
  )
}
