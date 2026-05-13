import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitPaymentProofMutation } from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Upload, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const PAYMENT_METHODS = [
  { value: 'gcash', label: 'GCash' },
  { value: 'bankTransfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
] as const

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

interface ProofUploadFormProps {
  invoiceId: string
  invoiceAmount: number
  currency?: string
  orgId: string
  onSuccess?: () => void
}

export function ProofUploadForm({
  invoiceId,
  invoiceAmount,
  currency = 'PHP',
  orgId,
  onSuccess,
}: ProofUploadFormProps) {
  const queryClient = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const submitMutOpts = submitPaymentProofMutation()
  const submitMutation = useMutation({
    ...submitMutOpts,
    onSuccess: () => {
      toast.success('Payment submitted', {
        description: 'Your proof is pending officer confirmation.',
      })
      queryClient.invalidateQueries({ queryKey: ['listDuesPayments'] })
      queryClient.invalidateQueries({ queryKey: ['listDuesInvoices'] })
      onSuccess?.()
    },
    onError: (err: any) => {
      const msg = err?.body?.error ?? err?.message ?? 'Submission failed'
      toast.error(msg)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, or PDF.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.')
      return
    }
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !paymentMethod) return

    try {
      setUploading(true)
      // Step 1: Upload file to storage via multipart
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'dues-proof')

      const uploadResponse = await fetch('/api/storage/files', {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // No Content-Type header — browser sets multipart boundary
      })
      if (!uploadResponse.ok) throw new Error('File upload failed')
      const uploadRes = await uploadResponse.json()
      const storageKey = uploadRes.key ?? uploadRes.data?.key

      if (!storageKey) throw new Error('Upload failed — no storage key returned')

      // Step 2: Submit proof
      submitMutation.mutate({
        body: {
          invoiceId,
          amount: BigInt(invoiceAmount) as any,
          currency,
          paymentMethod: paymentMethod as any,
          referenceNumber: referenceNumber || undefined,
          proofStorageKey: storageKey,
          proofFileName: file.name,
          proofMimeType: file.type,
        },
      })
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const busy = uploading || submitMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger>
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Reference Number (optional)</Label>
        <Input
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="GCash ref # or bank transfer ref"
        />
      </div>

      <div className="space-y-2">
        <Label>Proof of Payment</Label>
        <div
          className="border-2 border-dashed rounded-[12px] p-6 text-center cursor-pointer hover:border-[var(--color-primary)]/50 bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] transition-colors"
          style={{ borderColor: file ? 'var(--color-primary)' : 'var(--color-surface-border-glass)' }}
          onClick={() => document.getElementById('proof-file-input')?.click()}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>{file.name}</span>
              <span className="text-[var(--color-muted)]">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="h-8 w-8 mx-auto text-[var(--color-muted)]" />
              <p className="text-sm text-[var(--color-muted)]">
                Upload GCash screenshot or bank transfer receipt
              </p>
              <p className="text-xs text-[var(--color-muted)]">JPEG, PNG, or PDF (max 10MB)</p>
            </div>
          )}
          <input
            id="proof-file-input"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <Button type="submit" disabled={!file || !paymentMethod || busy} className="w-full">
        {busy ? 'Submitting...' : 'Submit Payment Proof'}
      </Button>
    </form>
  )
}
