import type { Context } from 'hono'

export async function mintMyPaymentLink(ctx: Context): Promise<Response> {
  return ctx.json({ error: 'Not implemented' }, 501)
}
