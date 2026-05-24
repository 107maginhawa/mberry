import { eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { user as userTable } from '@/generated/better-auth/schema';

// ═══════════════════════════════════════════════════════════════
// Environment constants
// ═══════════════════════════════════════════════════════════════

export const DATABASE_URL = process.env['DATABASE_URL'] || 'postgres://postgres@localhost:5432/monobase';
export const API_URL = process.env['API_URL'] || 'http://localhost:7213';
export const PASSWORD = 'TestPass123!';

// ═══════════════════════════════════════════════════════════════
// Relative date helpers — all seed dates computed from NOW
// so data never ages out
// ═══════════════════════════════════════════════════════════════

export const NOW = new Date();
export const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);
export const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86400000);
export const dateStr = (d: Date) => d.toISOString().split('T')[0]!;

/** Active member: dues expire 7 months from now */
export const ACTIVE_EXPIRY = dateStr(daysFromNow(210));
/** Grace member: dues expired N days ago (within 30-day grace) */
export const graceExpiry = (daysBack: number) => dateStr(daysAgo(daysBack));
/** Lapsed member: dues expired N days ago (past 30-day grace) */
export const lapsedExpiry = (daysBack: number) => dateStr(daysAgo(daysBack));
/** Officer term: started 10 months ago, ends 2 months from now */
export const TERM_START = daysAgo(300);
export const TERM_END = daysFromNow(65);
/** Membership start: ~1 year ago */
export const MEMBERSHIP_START = dateStr(daysAgo(365));

// ═══════════════════════════════════════════════════════════════
// Auth helpers
// ═══════════════════════════════════════════════════════════════

export function extractCookie(res: Response): string {
  const cookies: string[] = [];
  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get('set-cookie') || ''];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) cookies.push(match[1]!);
  }
  return cookies.join('; ');
}

export async function verifyEmail(db: ReturnType<typeof drizzle>, email: string) {
  await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.email, email));
}
