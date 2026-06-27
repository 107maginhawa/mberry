import { QRCodeSVG } from 'qrcode.react'
import {
  Card, CardHeader, CardTitle, CardContent,
  Skeleton, Avatar, AvatarImage, AvatarFallback, StatusBadge, ErrorState, EmptyState,
} from '@monobase/ui'
import { useIdCard } from './use-id-card'

const KNOWN_STATUS = ['active', 'grace', 'lapsed', 'pending', 'suspended'] as const
type CardStatus = (typeof KNOWN_STATUS)[number]

export function IdCardView() {
  const { isLoading, isError, data } = useIdCard()

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-40 w-40" />
        </CardContent>
      </Card>
    )
  }
  if (isError) {
    return (
      <Card><CardHeader><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
        <CardContent><ErrorState message="Couldn't load your card. Please refresh." /></CardContent>
      </Card>
    )
  }
  if (!data) {
    return (
      <Card><CardHeader><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
        <CardContent><EmptyState headline="No active membership" description="Contact your chapter officer if you believe this is a mistake." /></CardContent>
      </Card>
    )
  }

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ')
  const initials = [data.firstName?.[0], data.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const status: CardStatus = (KNOWN_STATUS as readonly string[]).includes(data.membershipStatus)
    ? (data.membershipStatus as CardStatus) : 'pending'
  const validLabel = data.validUntil
    ? new Date(data.validUntil).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  // QR bundles payload+signature JWT-style; a future verifier UI splits on '.' and
  // POSTs the payload to verifyCredentialPublic. Verifier page is out of scope this slice.
  const qrData = `${data.qrPayload}.${data.qrSignature}`

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-section font-semibold text-foreground">{data.organizationName}</p>
        <div className="flex items-center gap-3">
          <Avatar>
            {data.photoUrl && <AvatarImage src={data.photoUrl} alt={`${fullName} photo`} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-body font-semibold text-foreground">{fullName}</p>
            {data.licenseNumber && <p className="text-body text-muted-foreground">License {data.licenseNumber}</p>}
          </div>
        </div>
        <StatusBadge status={status} />
        {validLabel && <p className="text-body text-muted-foreground"><span className="font-medium">Valid until</span> {validLabel}</p>}
        <figure className="flex flex-col items-center gap-2 pt-2">
          <QRCodeSVG value={qrData} size={160} aria-label="Membership QR code — scan to verify" />
          <figcaption className="text-body text-muted-foreground">Scan to verify membership</figcaption>
        </figure>
        {data.verifyCredentialNumber && <p className="text-center font-mono text-body text-muted-foreground">{data.verifyCredentialNumber}</p>}
      </CardContent>
    </Card>
  )
}
