/**
 * Shared utility that assembles ID card data for a person + org.
 * Used by both getMyIdCard (JSON) and getMyIdCardPdf (PDF download).
 */

import { createHmac } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { ensureMemberCardCredential } from '@/handlers/association:member/utils/ensure-member-card-credential';

export interface IdCardData {
  personId: string;
  firstName: string;
  lastName: string | null;
  licenseNumber: string | null;
  organizationName: string;
  membershipStatus: string;
  photoUrl: string | null;
  qrPayload: string; // base64 encoded JSON
  qrSignature: string; // HMAC-SHA256 hex
  validUntil: string | null; // ISO date string
  verifyCredentialNumber: string | null; // member-card digital-credential number for the public QR (Batch A2)
}

export async function getIdCardData(
  db: DatabaseInstance,
  personId: string,
  orgId: string,
  logger?: any,
): Promise<IdCardData | null> {
  // Query person
  const personRows = await db
    .select()
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  const person = personRows[0];
  if (!person) return null;

  // Query membership for this org
  const membershipRows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.personId, personId), eq(memberships.organizationId, orgId)))
    .limit(1);
  const membership = membershipRows[0];

  // Query org name
  const orgRows = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const organizationName = orgRows[0]?.name ?? 'Unknown Organization';

  const status = membership?.status ?? 'unknown';
  const validUntil = membership?.duesExpiryDate ?? null;
  const licenseNumber = person.licenseNumber ?? person.prcId ?? null;

  // Build QR payload. timestamp (issued-at) lets verifiers detect stale/replayed
  // codes — validUntil bounds membership validity, timestamp bounds the QR itself (BR-18).
  const payload = {
    version: 1,
    personId,
    orgId,
    licenseNumber,
    status,
    validUntil,
    timestamp: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify(payload);
  const qrPayload = Buffer.from(payloadJson).toString('base64');

  // HMAC-SHA256 signature.
  // FIX-004 (G-04): fail closed. The old `?? 'fallback-secret'` made ID cards
  // forgeable in any env missing the secret. Prefer a dedicated key, fall back
  // to AUTH_SECRET (required by core/config.ts in every env), and THROW rather
  // than sign with a known literal.
  const secret = process.env['ID_CARD_HMAC_SECRET'] ?? process.env['AUTH_SECRET'];
  if (!secret) {
    throw new Error(
      'ID card HMAC secret is not configured. Set ID_CARD_HMAC_SECRET (or AUTH_SECRET) — ' +
        'refusing to sign an ID card with an insecure fallback (BR-18).',
    );
  }
  const qrSignature = createHmac('sha256', secret).update(payloadJson).digest('hex');

  // Photo URL from avatar
  const photoUrl = person.avatar?.url ?? null;

  // Batch A2 / FIX-001: lazily ensure an active member has a member-card digital
  // credential so the public QR has a verifiable identifier to point at. Only
  // active memberships get one; best-effort (null on failure — card still renders).
  const verifyCredentialNumber =
    membership && status === 'active'
      ? await ensureMemberCardCredential(db, logger, {
          personId,
          orgId,
          membershipId: membership.id,
          expiresAt: validUntil ? new Date(validUntil) : null,
        })
      : null;

  return {
    personId,
    firstName: person.firstName,
    lastName: person.lastName ?? null,
    licenseNumber,
    organizationName,
    membershipStatus: status,
    photoUrl,
    qrPayload,
    qrSignature,
    validUntil,
    verifyCredentialNumber,
  };
}
