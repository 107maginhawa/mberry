import React, { useState, type FormEvent } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@monobase/ui'
import type { AssocRow } from './use-associations'
import type { CreateOrgInput } from './use-create-org'

interface CreateOrgViewProps {
  associations: AssocRow[]
  onSubmit: (input: CreateOrgInput) => Promise<void>
  pending: boolean
  error: string
}

export default function CreateOrgView({ associations, onSubmit, pending, error }: CreateOrgViewProps) {
  const [name, setName] = useState('')
  const [associationId, setAssociationId] = useState('')
  const [orgType, setOrgType] = useState('chapter')
  const [region, setRegion] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const noAssociations = associations.length === 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSubmit({
      associationId,
      name,
      orgType,
      ...(region ? { region } : {}),
      ...(contactEmail ? { contactEmail } : {}),
    })
  }

  return (
    <Card className="max-w-lg mx-auto mt-8">
      <CardHeader>
        <CardTitle>Create organization</CardTitle>
      </CardHeader>
      <CardContent>
        {noAssociations && (
          <div role="alert" className="text-destructive text-sm mb-4">
            Seed an association first before creating an organization.
          </div>
        )}
        {error && (
          <div role="alert" className="text-destructive text-sm mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              required
              className="min-h-tap"
              placeholder="e.g. NCR Chapter"
            />
          </div>

          <div>
            <Label htmlFor="association">Association *</Label>
            {/* aria-label forwarded so test mock can find by combobox name */}
            <Select aria-label="Association" onValueChange={setAssociationId} value={associationId}>
              <SelectTrigger id="association" className="min-h-tap">
                <SelectValue placeholder="Select association" />
              </SelectTrigger>
              <SelectContent>
                {associations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="orgType">Type *</Label>
            <Select aria-label="Type" onValueChange={setOrgType} value={orgType}>
              <SelectTrigger id="orgType" className="min-h-tap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chapter">Chapter</SelectItem>
                <SelectItem value="society">Society</SelectItem>
                <SelectItem value="national">National</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="region">Region (optional)</Label>
            <Input
              id="region"
              value={region}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegion(e.target.value)}
              className="min-h-tap"
              placeholder="e.g. NCR"
            />
          </div>

          <div>
            <Label htmlFor="contactEmail">Contact email (optional)</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
              className="min-h-tap"
              placeholder="e.g. chapter@pda.org.ph"
            />
          </div>

          <Button
            type="submit"
            className="w-full min-h-tap"
            disabled={pending || noAssociations}
          >
            {pending ? 'Creating…' : 'Create organization'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
