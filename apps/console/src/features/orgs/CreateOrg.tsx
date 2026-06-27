import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAssociations } from './use-associations'
import { useCreateOrg, type CreateOrgInput } from './use-create-org'
import CreateOrgView from './CreateOrgView'

export default function CreateOrg() {
  const navigate = useNavigate()
  const { associations } = useAssociations()
  const { submit, pending, error } = useCreateOrg()
  const [localError, setLocalError] = useState('')

  async function onSubmit(input: CreateOrgInput) {
    setLocalError('')
    try {
      const org = await submit(input)
      toast.success(`Organization "${org.name}" created`)
      void navigate({ to: '/' })
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <CreateOrgView
      associations={associations}
      onSubmit={onSubmit}
      pending={pending}
      error={localError || error}
    />
  )
}
