/**
 * Invite token validation — delegates to server for full validation.
 * Client-side utilities below handle format checks and preview parsing
 * without a server round-trip (UX: show invite details before claiming).
 */

import { client } from '@monobase/sdk-ts/client'

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
    licenseNumber?: string;
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
    const response = await fetch(`/api/invite/${encodeURIComponent(token)}/validate`);
    const body = await response.json();

    if (response.ok) {
      return { ok: true, data: body as InviteValidation };
    }
    return { ok: false, error: body as InviteError, status: response.status };
  } catch {
    return {
      ok: false,
      error: { error: 'Network error. Please check your connection.' },
      status: 0,
    };
  }
}

/**
 * Claim an invite token (requires authentication).
 */
export async function claimInviteToken(token: string): Promise<
  { ok: true; data: { claimed: boolean; orgId: string } } | { ok: false; error: string }
> {
  try {
    const response = await fetch(`/api/invite/${encodeURIComponent(token)}/claim`, {
      method: 'POST',
      credentials: 'include',
    });
    const body = await response.json();

    if (response.ok) {
      return { ok: true, data: body };
    }
    return { ok: false, error: body.error || 'Failed to claim invitation' };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection.' };
  }
}
