/**
 * Lazily ensure a member-card digital credential exists for a membership, so the
 * ID-card QR has a verifiable identifier to point at (FIX-001 / Batch A2).
 *
 * The verify chain (Batch A) reuses the EXISTING credential token + public-verify
 * surface per the Step-29 Q1 decision — but nothing PRODUCED a credential for an
 * ordinary member (only officer-initiated `issueDigitalCredential` + seed did).
 * This closes that producer gap with the smallest correct change: when a member
 * views/downloads their ID card, ensure (idempotently) that an active `memberCard`
 * digital credential exists, auto-provisioning the org's memberCard template on
 * first need, and return its credential number for the QR.
 *
 * Best-effort: any failure returns null so the ID card still renders (QR absent)
 * rather than breaking the card. Reuses the existing fail-closed token secret.
 */

import { randomUUID } from 'node:crypto';
import type { DatabaseInstance } from '@/core/database';
import { CredentialTemplateRepository, DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';
import { createCredentialToken, resolveCredentialVerifySecret } from './credential-token';

interface EnsureArgs {
  personId: string;
  orgId: string;
  membershipId?: string | null;
  expiresAt?: Date | null;
}

export async function ensureMemberCardCredential(
  db: DatabaseInstance,
  logger: any,
  { personId, orgId, membershipId, expiresAt }: EnsureArgs,
): Promise<string | null> {
  try {
    const templateRepo = new CredentialTemplateRepository(db, logger);
    const credentialRepo = new DigitalCredentialRepository(db, logger);

    // 1. Ensure an active memberCard template exists for the org.
    let template = await templateRepo.findOne({ organizationId: orgId, type: 'memberCard', status: 'active' });
    if (!template) {
      template = await templateRepo.createOne({
        organizationId: orgId,
        name: 'Member Card',
        type: 'memberCard',
        status: 'active',
      } as any);
    }

    // 2. Return the existing active member-card credential if one already exists.
    const existing = await credentialRepo.findOne({
      organizationId: orgId,
      personId,
      templateId: template.id,
      status: 'active',
    });
    if (existing) return existing.credentialNumber;

    // 3. Issue a new member-card credential + verification token.
    const credentialNumber = `MC-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const credential = await credentialRepo.createOne({
      organizationId: orgId,
      personId,
      templateId: template.id,
      membershipId: membershipId ?? null,
      credentialNumber,
      issuedAt: new Date(),
      expiresAt: expiresAt ?? null,
      status: 'active',
    } as any);

    const token = createCredentialToken(credential.id, orgId, resolveCredentialVerifySecret());
    const baseUrl = process.env['PUBLIC_URL'] || 'http://localhost:7213';
    await credentialRepo.updateOneById(credential.id, {
      qrPayload: token,
      verificationUrl: `${baseUrl}/association/member/credentials/public-verify`,
    } as any);

    return credentialNumber;
  } catch (err) {
    logger?.warn?.({ err, personId, orgId }, 'ensureMemberCardCredential failed (best-effort)');
    return null;
  }
}
