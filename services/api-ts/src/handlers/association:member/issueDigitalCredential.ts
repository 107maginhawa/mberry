import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { IssueDigitalCredentialBody } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { CredentialTemplateRepository, DigitalCredentialRepository } from './repos/credentials.repo';
import type { DigitalCredential } from './repos/credentials.schema';
import { MembershipRepository } from './repos/membership.repo';
import { withComputedStatus } from './utils/membership-status-middleware';
import { createCredentialToken } from './utils/credential-token';

/**
 * issueDigitalCredential
 *
 * Path: POST /association/member/credentials/issue
 * OperationId: issueDigitalCredential
 *
 * Creates a digital credential from a template, generates an HMAC verification token.
 */
export async function issueDigitalCredential(
  ctx: ValidatedContext<IssueDigitalCredentialBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // [BR-19] Verify the person has an active membership before issuing credentials
  if (body.membershipId) {
    const membershipRepo = new MembershipRepository(db, logger);
    const membership = await membershipRepo.findOneById(body.membershipId);
    if (!membership) throw new NotFoundError('Membership');
    const enriched = withComputedStatus(membership);
    if (enriched.status !== 'active') {
      throw new ForbiddenError(
        `Cannot issue credential: membership status is "${enriched.status}". Only active memberships are eligible.`
      );
    }
  } else if (body.personId) {
    // If no membershipId provided, check if person has any active membership in this org
    const membershipRepo = new MembershipRepository(db, logger);
    const membership = await membershipRepo.findByPersonAndOrg(body.personId, orgId);
    if (!membership) throw new ForbiddenError('Cannot issue credential: no membership found for this person');
    const enriched = withComputedStatus(membership);
    if (enriched.status !== 'active') {
      throw new ForbiddenError(
        `Cannot issue credential: membership status is "${enriched.status}". Only active memberships are eligible.`
      );
    }
  }

  // Verify template exists
  const templateRepo = new CredentialTemplateRepository(db, logger);
  const template = await templateRepo.findOneById(body.templateId);
  if (!template) throw new NotFoundError('Credential template');

  // Calculate expiration from template validity period
  let expiresAt: Date | null = null;
  if (template.validityPeriod) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + template.validityPeriod);
  }

  const credentialRepo = new DigitalCredentialRepository(db, logger);

  // Create the credential first to get the ID
  const credential = await credentialRepo.createOne({
    organizationId: orgId,
    personId: body.personId,
    templateId: body.templateId,
    membershipId: body.membershipId ?? null,
    credentialNumber: body.credentialNumber,
    issuedAt: new Date(),
    expiresAt,
    status: 'active',
  });

  // Generate HMAC verification token
  const secret = process.env['CREDENTIAL_VERIFY_SECRET'] || 'dev-credential-verify-secret';
  const token = createCredentialToken(credential.id, orgId, secret);

  // Update credential with qrPayload and verificationUrl
  const baseUrl = process.env['PUBLIC_URL'] || 'http://localhost:7213';
  const verificationUrl = `${baseUrl}/association/member/credentials/public-verify`;

  const updated = await credentialRepo.updateOneById(credential.id, {
    qrPayload: token,
    verificationUrl,
  } as Partial<DigitalCredential>);

  ctx.set('auditResourceId', credential.id);
  ctx.set('auditDescription', `Digital credential "${body.credentialNumber}" issued for person ${body.personId}`);

  return ctx.json(updated, 201);
}
