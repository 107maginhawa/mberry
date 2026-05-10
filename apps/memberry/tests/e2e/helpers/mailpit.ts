import type { Page } from '@playwright/test'

const MAILPIT_API = process.env.MAILPIT_API_URL ?? 'http://localhost:8025/api/v1'

export interface MailpitMessage {
  ID: string
  From: { Address: string; Name: string }
  To: Array<{ Address: string; Name: string }>
  Subject: string
  Snippet: string
  Created: string
}

/**
 * Check if Mailpit is reachable.
 */
export async function isMailpitAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILPIT_API}/info`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Get messages for a specific email address.
 * Returns newest first.
 */
export async function getMessagesFor(email: string, limit = 10): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT_API}/search?query=to:${encodeURIComponent(email)}&limit=${limit}`)
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`)
  const data = await res.json()
  return data.messages ?? []
}

/**
 * Wait for a message matching criteria to arrive.
 * Polls every 500ms up to timeout.
 */
export async function waitForMessage(
  email: string,
  opts: { subject?: RegExp; timeout?: number } = {},
): Promise<MailpitMessage> {
  const { subject, timeout = 10000 } = opts
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const messages = await getMessagesFor(email)
    const match = messages.find((m) => !subject || subject.test(m.Subject))
    if (match) return match
    await new Promise((r) => setTimeout(r, 500))
  }

  throw new Error(`No message for ${email} matching ${subject ?? 'any'} within ${timeout}ms`)
}

/**
 * Get the full HTML body of a message by ID.
 */
export async function getMessageHtml(messageId: string): Promise<string> {
  const res = await fetch(`${MAILPIT_API}/message/${messageId}/html`)
  if (!res.ok) throw new Error(`Mailpit get html failed: ${res.status}`)
  return res.text()
}

/**
 * Extract links from a message's HTML body.
 */
export async function extractLinksFromMessage(messageId: string): Promise<string[]> {
  const html = await getMessageHtml(messageId)
  const links: string[] = []
  const regex = /href="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1]!)
  }
  return links
}

/**
 * Delete all messages in Mailpit (use in test setup for clean state).
 */
export async function deleteAllMessages(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' })
}

/**
 * Helper to use within Playwright test: navigate to a link from an email.
 */
export async function followEmailLink(
  page: Page,
  email: string,
  opts: { subject?: RegExp; linkPattern?: RegExp } = {},
): Promise<void> {
  const msg = await waitForMessage(email, { subject: opts.subject })
  const links = await extractLinksFromMessage(msg.ID)
  const link = opts.linkPattern ? links.find((l) => opts.linkPattern!.test(l)) : links[0]
  if (!link) throw new Error(`No matching link in message ${msg.ID}`)
  await page.goto(link)
}
