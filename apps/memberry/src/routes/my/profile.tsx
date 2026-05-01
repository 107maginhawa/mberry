import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { formatPersonName, formatLicenseDisplay, getInitials } from '@/features/profile/lib/profile-display'

export const Route = createFileRoute('/my/profile')({
  component: MyProfilePage,
})

function MyProfilePage() {
  const { data: person, isLoading } = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
  })

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading profile...</div>

  const p = person as any

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#554B68] text-white flex items-center justify-center text-xl font-bold">
            {getInitials(p?.firstName || '?', p?.lastName)}
          </div>
          <div>
            <div className="text-lg font-medium">
              {formatPersonName(p?.firstName || '', p?.lastName, p?.middleName)}
            </div>
            {p?.specialization && (
              <div className="text-sm text-muted-foreground">{p.specialization}</div>
            )}
            {formatLicenseDisplay(p?.licenseNumber, p?.prcId) && (
              <div className="text-xs text-muted-foreground">
                {formatLicenseDisplay(p.licenseNumber, p.prcId)}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 text-sm">
          {p?.contactInfo?.email && (
            <div><span className="font-medium">Email:</span> {p.contactInfo.email}</div>
          )}
          {p?.contactInfo?.phone && (
            <div><span className="font-medium">Phone:</span> {p.contactInfo.phone}</div>
          )}
          {p?.timezone && (
            <div><span className="font-medium">Timezone:</span> {p.timezone}</div>
          )}
        </div>
      </div>
    </div>
  )
}
