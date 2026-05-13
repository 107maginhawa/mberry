import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@monobase/ui"
import { PersonalInfoForm } from '@/features/person/components/personal-info-form'
import { AddressForm } from '@/features/person/components/address-form'
import { ContactInfoForm } from '@/features/person/components/contact-info-form'
import { PreferencesForm } from '@/features/person/components/preferences-form'
import {
  cancelMyAccountDeletionMutation,
  exportMyDataOptions,
  getPersonOptions,
  getPersonQueryKey,
  requestMyAccountDeletionMutation,
  updatePersonMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { buildPatch } from '@monobase/sdk-ts/utils/patch'
import { useFileUpload } from '@monobase/sdk-ts/flows'
import type { PersonUpdateRequest } from '@monobase/sdk-ts/generated/types.gen'
import { toast } from 'sonner'

// Deletion fields are stored in the DB but not yet exposed in TypeSpec — cast until spec is updated
type PersonWithDeletion = {
  deletionRequestedAt?: string | null
  deletionScheduledAt?: string | null
  deletionCompletedAt?: string | null
}

export const Route = createFileRoute('/_dashboard/settings/account')({
  component: AccountSettingsPage,
  beforeLoad: async ({ context }) => {
    return { user: context.auth.user }
  },
})

function AccountSettingsPage() {
  const queryClient = useQueryClient()
  const { upload } = useFileUpload()

  const { data: person, isLoading: isLoadingPerson } = useQuery(
    getPersonOptions({ path: { person: 'me' } }),
  )

  // One mutation backs all four section forms — each onSubmit shapes its own
  // partial body via buildPatch and the helper handles the wire call.
  const updatePerson = useMutation({
    ...updatePersonMutation(),
    meta: {
      toast: {
        success: 'Profile updated',
        error: (err: unknown) =>
          err instanceof Error ? err.message : 'Failed to update profile',
      },
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getPersonQueryKey({ path: { person: 'me' } }),
      })
    },
  })

  const requestDeletion = useMutation({
    ...requestMyAccountDeletionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPersonQueryKey({ path: { person: 'me' } }) })
      toast.success('Account deletion requested. You have 30 days to cancel.')
    },
    onError: () => toast.error('Failed to request deletion'),
  })

  const cancelDeletion = useMutation({
    ...cancelMyAccountDeletionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPersonQueryKey({ path: { person: 'me' } }) })
      toast.success('Deletion request cancelled. Your account is safe.')
    },
    onError: () => toast.error('Failed to cancel deletion'),
  })

  const { refetch: fetchExport, isFetching: isExporting } = useQuery({
    ...exportMyDataOptions(),
    enabled: false,
  })

  const handleExport = async () => {
    const result = await fetchExport()
    if (!result.data) { toast.error('Failed to export data'); return; }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data export downloaded')
  }

  const personWithDeletion = person as (typeof person & PersonWithDeletion) | undefined
  const daysRemaining = personWithDeletion?.deletionScheduledAt
    ? Math.max(0, Math.ceil((new Date(personWithDeletion.deletionScheduledAt).getTime() - Date.now()) / 86400000))
    : 0

  const submitUpdate = async (patch: PersonUpdateRequest) => {
    if (!person) return
    await updatePerson.mutateAsync({
      path: { person: person.id },
      body: buildPatch<PersonUpdateRequest>(patch),
    })
  }

  const handleAvatarUpload = async (file: File): Promise<{ file?: string, url: string }> => {
    const uploaded = await upload(file)
    return { file: uploaded.fileId, url: uploaded.downloadUrl }
  }

  if (isLoadingPerson) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalInfoForm
            defaultValues={person as never}
            onSubmit={async (data) => {
              await submitUpdate(data as PersonUpdateRequest)
            }}
            mode="edit"
            memberSince={person?.createdAt}
            onAvatarUpload={handleAvatarUpload}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Manage your contact details</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactInfoForm
            defaultValues={person?.contactInfo as never}
            onSubmit={async (data) => {
              await submitUpdate({ contactInfo: data })
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Update your address information</CardDescription>
        </CardHeader>
        <CardContent>
          <AddressForm
            defaultValues={person?.primaryAddress as never}
            onSubmit={async (data) => {
              await submitUpdate({ primaryAddress: data })
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Manage your account preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            defaultValues={person as never}
            onSubmit={async (data) => {
              await submitUpdate(data as PersonUpdateRequest)
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export My Data</CardTitle>
          <CardDescription>
            Download all your personal data as a JSON file (profile, memberships, payments, training, certificates, events)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting} variant="outline">
            {isExporting ? 'Preparing...' : 'Download My Data'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            {!personWithDeletion?.deletionRequestedAt
              ? 'Permanently delete your account and all associated data. This action has a 30-day grace period.'
              : `Account deletion scheduled. Your data will be permanently removed in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {!personWithDeletion?.deletionRequestedAt ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Request Account Deletion</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your account will be scheduled for deletion. You have 30 days to cancel this request.
                    After 30 days, your personal data will be permanently anonymized. Financial records
                    (dues payments, invoices) are retained per legal requirements.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => requestDeletion.mutate({})}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="outline"
              onClick={() => cancelDeletion.mutate({})}
              disabled={cancelDeletion.isPending}
            >
              {cancelDeletion.isPending ? 'Cancelling...' : 'Cancel Deletion Request'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
