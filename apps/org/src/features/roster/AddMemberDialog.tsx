import { useState } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@monobase/ui'
import { useTiers } from '../roster-import/use-tiers'
import { useImportRoster } from '../roster-import/use-import-roster'

// Add ONE member mid-year (design Round-2 A1 — no CSV on a phone). Reuses the frozen
// importRosterMembers endpoint with a single-row payload (match-or-create), so this is
// pure FE over a frozen engine. Not a money action → no confirm step; success/skip/fail
// is reported with a toast. useImportRoster invalidates ['roster', orgId] → the directory
// refetches and the new member appears.
export function AddMemberDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false)
  const { tiers, loading: tiersLoading } = useTiers(orgId)
  const add = useImportRoster(orgId)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [tierId, setTierId] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFirstName(''); setLastName(''); setEmail(''); setLicenseNumber(''); setTierId(''); setError(null)
  }

  function submit() {
    // Engine requires firstName (new person) + (email OR licenseNumber) to match/create.
    if (!firstName.trim()) return setError('First name is required.')
    if (!email.trim() && !licenseNumber.trim()) return setError('Enter an email or a license number.')
    if (!tierId) return setError('Pick a membership tier.')
    setError(null)
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    add.mutate(
      {
        tierId,
        members: [{
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          licenseNumber: licenseNumber.trim() || undefined,
        }],
      },
      {
        onSuccess: (res) => {
          if (res.imported > 0) toast.success(`Added ${name}`)
          else if (res.skipped > 0) toast.info(`${name} is already a member`)
          else toast.error(res.errors[0]?.error ?? `Couldn't add ${name}`)
          if (res.failed === 0) { reset(); setOpen(false) }
          else setError(res.errors[0]?.error ?? 'That member could not be added.')
        },
        onError: (e) => { setError(e.message); toast.error(e.message) },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-tap shrink-0">Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>Add one member to your chapter. Email or license number is required.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-first">First name</Label>
            <Input id="add-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="min-h-tap" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-last">Last name</Label>
            <Input id="add-last" value={lastName} onChange={(e) => setLastName(e.target.value)} className="min-h-tap" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-email">Email</Label>
            <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-tap" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-license">License number</Label>
            <Input id="add-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="min-h-tap" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-tier">Membership tier</Label>
            <select
              id="add-tier"
              className="min-h-tap rounded-md border border-[var(--color-border)] bg-surface px-3 text-body"
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              disabled={tiersLoading}
            >
              <option value="">{tiersLoading ? 'Loading tiers…' : 'Select a tier…'}</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
          </div>

          {error && <p role="alert" className="text-body text-[var(--color-error)]">{error}</p>}

          <Button type="button" className="min-h-tap" disabled={add.isPending} onClick={submit}>
            {add.isPending ? 'Adding…' : 'Add member'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
