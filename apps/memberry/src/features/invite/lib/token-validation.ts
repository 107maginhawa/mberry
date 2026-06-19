/**
 * Invite token validation — delegates to server for full validation.
 * Client-side utilities below handle format checks and preview parsing
 * without a server round-trip (UX: show invite details before claiming).
 */

import { api, ApiError } from '@/lib/api'

// ---------------------------------------------------------------------------
// Client-side utilities (no server call needed)
// ---------------------------------------------------------------------------

/** Check if a token string has valid format (base64url, min length 8). */
export function isValidTokenFormat(token: string): boolean {
  if (!token || token.length < 8) return false;
  return /^[A-Za-z0-9_\-=.]+$/.test(token);
}

/** Check if a timestamp (ms) is in the past. */
export function isTokenExpired(timestampMs: number): boolean {
  return timestampMs < Date.now();
}

/** Parse the preview payload from an invite token (format: invite.<base64json>.sig). */
export function parseInviteToken(token: string): { orgId: string; orgName: string; role: string; expiresAt: number } | null {
  if (!token || token.length < 8) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1]!);
    const data = JSON.parse(json);
    if (!data.orgId) return null;
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server-delegated validation
// ---------------------------------------------------------------------------

export interface InviteValidation {
  valid: boolean;
  email: string;
  orgId: string;
  type: 'claim' | 'invite';
  metadata?: {
    name?: string;
    memberNumber?: string;
    membershipCategoryId?: string;
    membershipTierId?: string;
  };
  expiresAt: string;
}

export interface InviteError {
  error: string;
  code?: 'ALREADY_CLAIMED' | 'REVOKED' | 'EXPIRED';
  orgId?: string;
}

/**
 * Validate a token against the server.
 * Returns validation result or error info.
 */
export async function validateInviteToken(token: string): Promise<
  { ok: true; data: InviteValidation } | { ok: false; error: InviteError; status: number }
> {
  try {
    const data = await api.get<InviteValidation>(`/api/invite/validate/${encodeURIComponent(token)}`);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: (err.body ?? { error: err.message }) as InviteError, status: err.status };
    }
    return {
      ok: false,
      error: { error: 'Network error. Please check your connection.' },
      status: 0,
    };
  }
}

export interface ClaimInviteResult {
  claimed: boolean;
  organizationId: string;
  organizationSlug?: string | null;
  membershipStatus?: 'joined' | 'pendingApproval';
  membershipId?: string;
}

/**
 * Claim an invite token (requires authentication).
 */
export async function claimInviteToken(token: string): Promise<
  { ok: true; data: ClaimInviteResult } | { ok: false; error: string }
> {
  try {
    const data = await api.post<ClaimInviteResult>(`/api/invite/claim/${encodeURIComponent(token)}`);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) {
      interface ApiErrorBody { message?: string; error?: string; statusCode?: number }
      const body = err.body as ApiErrorBody | null | undefined;
      return { ok: false, error: body?.error || 'Failed to claim invitation' };
    }
    return { ok: false, error: 'Network error. Please check your connection.' };
  }
}
