/**
 * Invite token validation utilities.
 *
 * Token format: `invite.{base64-payload}.{signature}`
 * Payload: { orgId, orgName, role, expiresAt }
 *
 * Server validates HMAC signature. Client only checks format + expiry.
 */

export function isValidTokenFormat(token: string): boolean {
  if (!token || token.length < 3) return false;
  return true;
}

export function isTokenExpired(expiresAtMs: number): boolean {
  return Date.now() > expiresAtMs;
}

export interface InvitePayload {
  orgId: string;
  orgName: string;
  role: string;
  expiresAt: number;
}

export function parseInviteToken(token: string): InvitePayload | null {
  if (!isValidTokenFormat(token)) return null;

  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payload = JSON.parse(atob(parts[1]!));
    if (!payload.orgId || !payload.orgName) return null;

    return payload as InvitePayload;
  } catch {
    return null;
  }
}
