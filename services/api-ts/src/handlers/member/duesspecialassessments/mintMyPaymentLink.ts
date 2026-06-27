/**
 * mintMyPaymentLink — member self-serves a one-tap payment link for their own dues invoice.
 *
 * POST /org/:organizationId/payments/mint-mine
 * Auth: association:member (self)
 * Request: { invoiceId }
 * Response: { token, paymentUrl, expiresAt }
 *
 * Security invariants (in order):
 *   1. Ownership:     invoice.personId === caller.id         (IDOR guard)
 *   2. Org scope:     invoice.organizationId === orgId       (cross-org guard)
 *   3. Unpaid only:   status ∈ {generated, sent, overdue}   (terminal-status guard)
 *      NO membership/officer-term check — lapsed members who owe can still pay.
 *   4. Double-charge: at most one active token per invoice   (prevents two settleable tokens)
 *   5. Amount:        server-derived from invoice.totalAmount (no client amount param)
 *   6. createdByOfficer: null                               (member-initiated)
 *   7. TTL: 1 hour                                          (shorter than officer 72 h)
 */

import type { ValidatedContext } from '@/types/app'
import type { DatabaseInstance } from '@/core/database'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors'
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo'
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo'
import {
  generatePaymentToken,
  getPaymentTokenSecret,
} from './utils/payment-token'

const UNPAID = new Set(['generated', 'sent', 'overdue'])

/** 1 hour — self-serve tokens expire faster than officer-sent 72 h links */
const MEMBER_TOKEN_TTL_MS = 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mintMyPaymentLink(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user')
  if (!user) throw new UnauthorizedError()
  const personId = user.id as string

  const orgId = ctx.req.param('organizationId') ?? ''
  if (!orgId) return ctx.json({ error: 'organizationId is required' }, 400)

  const { invoiceId } = ctx.req.valid('json') as { invoiceId: string }

  const db = ctx.get('database') as DatabaseInstance

  // 1. Load invoice — amount is server-derived; no client amount param accepted.
  const invoice = await new DuesInvoiceRepository(db).findOneById(invoiceId)
  if (!invoice) throw new NotFoundError('Invoice not found')

  // 2. IDOR guard: the invoice must belong to the authenticated caller.
  if (invoice.personId !== personId) throw new ForbiddenError('Not your invoice')

  // 3. Org scope guard: the invoice must belong to the requested org context.
  if (invoice.organizationId !== orgId) throw new ForbiddenError('Invoice not in this organization')

  // 4. Terminal-status guard: only unpaid invoices are payable.
  //    paid / cancelled / writtenOff are terminal — no new tokens are minted.
  //    Lapsed members who own an overdue invoice are NOT blocked here.
  if (!UNPAID.has(invoice.status)) {
    return ctx.json({ error: 'This invoice is not payable.' }, 409)
  }

  const tokenRepo = new PaymentTokenRepository(db)

  // 5. Double-charge guard: exactly one active (unused, unrevoked, unexpired) token
  //    is permitted per invoice per member. Two active tokens = two settleable charges.
  const existing = await tokenRepo.findActiveForInvoice(invoiceId, personId)
  if (existing) {
    return ctx.json({ error: 'A payment is already in progress for this invoice.' }, 409)
  }

  // 6. Mint: generate HMAC token (raw sent to member, hash stored in DB).
  //    Amount from invoice.totalAmount — bigint(mode:'number') is already a JS number.
  const secret = getPaymentTokenSecret()
  const { raw, hash } = generatePaymentToken(secret)
  const expiresAt = new Date(Date.now() + MEMBER_TOKEN_TTL_MS)

  await tokenRepo.create({
    tokenHash: hash,
    personId,
    organizationId: orgId,
    invoiceId,
    amount: Number(invoice.totalAmount),
    currency: invoice.currency ?? 'PHP',
    expiresAt,
    createdByOfficer: null,
  })

  return ctx.json({ token: raw, paymentUrl: `/pay/${raw}`, expiresAt: expiresAt.toISOString() }, 201)
}
