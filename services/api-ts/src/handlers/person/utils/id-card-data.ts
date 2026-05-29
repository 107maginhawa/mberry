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
}

export async function getIdCardData(
  db: DatabaseInstance,
  personId: string,
  orgId: string,
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

  // HMAC-SHA256 signature
  const secret = process.env['AUTH_SECRET'] ?? 'fallback-secret';
  const qrSignature = createHmac('sha256', secret).update(payloadJson).digest('hex');

  // Photo URL from avatar
  const photoUrl = person.avatar?.url ?? null;

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
  };
}
