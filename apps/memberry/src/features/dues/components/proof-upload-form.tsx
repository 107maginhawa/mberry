import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  submitPaymentProofMutation,
  listDuesPaymentsQueryKey,
  listDuesInvoicesQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import { Button, Input, Label } from '@monobase/ui'
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

const proofUploadSchema = z.object({
  paymentMethod: z.string().min(1, 'Payment method is required'),
  referenceNumber: z.string().optional(),
})

type ProofUploadFormData = z.infer<typeof proofUploadSchema>

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
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProofUploadFormData>({
    resolver: zodResolver(proofUploadSchema),
    defaultValues: {
      paymentMethod: '',
      referenceNumber: '',
    },
  })

  const submitMutation = useMutation(submitPaymentProofMutation())
  const handleSubmitSuccess = () => {
    toast.success('Payment submitted', {
      description: 'Your proof is pending officer confirmation.',
    })
    queryClient.invalidateQueries({ queryKey: listDuesPaymentsQueryKey({ headers: { 'x-org-id': orgId } }) })
    queryClient.invalidateQueries({ queryKey: listDuesInvoicesQueryKey({ headers: { 'x-org-id': orgId } }) })
    onSuccess?.()
  }

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

  async function onSubmit(data: ProofUploadFormData) {
    if (!file) {
      toast.error('Please upload a proof of payment file.')
      return
    }

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
          amount: BigInt(invoiceAmount),
          currency,
          paymentMethod: data.paymentMethod as 'online' | 'cash' | 'check' | 'bankTransfer' | 'gcash' | 'other',
          referenceNumber: data.referenceNumber || undefined,
          proofStorageKey: storageKey,
          proofFileName: file.name,
          proofMimeType: file.type,
        },
      }, {
        onSuccess: handleSubmitSuccess,
        onError: (err: unknown) => {
          const msg = (err as { body?: { error?: string }; message?: string })?.body?.error
            ?? (err as { message?: string })?.message
            ?? 'Submission failed'
          toast.error(msg)
        },
      })
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const busy = uploading || submitMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <Controller
          name="paymentMethod"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-describedby={errors.paymentMethod ? 'paymentMethod-error' : undefined}>
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
          )}
        />
        {errors.paymentMethod && (
          <p id="paymentMethod-error" role="alert" className="text-xs text-[var(--color-error)] mt-1">
            {errors.paymentMethod.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="referenceNumber">Reference Number (optional)</Label>
        <Input
          id="referenceNumber"
          placeholder="GCash ref # or bank transfer ref"
          {...register('referenceNumber')}
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
          <Input
            id="proof-file-input"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <Button type="submit" disabled={!file || busy} className="w-full">
        {busy ? 'Submitting...' : 'Submit Payment Proof'}
      </Button>
    </form>
  )
}
