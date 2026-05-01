/**
 * Invite token validation — delegates to server.
 * Raw token is opaque (HMAC-signed). Only the server can validate it.
 */

import { client } from '@monobase/sdk-ts/client'

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
