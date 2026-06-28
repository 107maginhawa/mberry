import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateOrganizationBody } from '@/generated/openapi/validators';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors';
import { OrganizationRepository, AssociationRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';
import { generateSlug, ensureUniqueSlug } from './utils/slug';
import { requireAdminTier, SUPER_ONLY } from '@/core/auth/admin-tier';

/**
 * createOrganization
 *
 * Path: POST /admin/organizations
 * OperationId: createOrganization
 */
export async function createOrganization(
  ctx: ValidatedContext<CreateOrganizationBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  // FIX-008 (G1) / Q1: creating an organization is a super-only mutation.
  const denied = requireAdminTier(ctx, SUPER_ONLY);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const orgRepo = new OrganizationRepository(db, logger);
  const assocRepo = new AssociationRepository(db, logger);

  // Guard the associationId shape before the lookup. An empty/malformed id reaches
  // the uuid column and Postgres throws at query time (leaking the raw SQL as a 500)
  // instead of cleanly returning "not found". Reject non-UUID input as a 400.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(body.associationId)) {
    throw new ValidationError('associationId must be a valid UUID');
  }

  // Verify association exists
  const association = await assocRepo.findById(body.associationId);
  if (!association) {
    throw new NotFoundError('Association not found');
  }

  // Check duplicate name within association
  const duplicate = await orgRepo.findByNameInAssociation(body.name, body.associationId);
  if (duplicate) {
    throw new ConflictError('Organization with this name already exists in this association');
  }

  // Generate unique slug from org name
  const baseSlug = generateSlug(body.name);
  if (!baseSlug) {
    throw new ValidationError('Organization name must contain at least one alphanumeric character');
  }
  const slug = await ensureUniqueSlug(baseSlug, orgRepo);

  // Set trial dates if trialDurationDays provided
  const now = new Date();
  const trialStartDate = body.trialDurationDays ? now : undefined;
  const trialEndDate = body.trialDurationDays
    ? new Date(now.getTime() + body.trialDurationDays * 24 * 60 * 60 * 1000)
    : undefined;

  const org = await orgRepo.create({
    associationId: body.associationId,
    name: body.name,
    slug,
    orgType: body.orgType,
    region: body.region ?? null,
    contactEmail: body.contactEmail ?? null,
    status: 'trial',
    trialStartDate: trialStartDate ?? null,
    trialEndDate: trialEndDate ?? null,
  });

  ctx.set('auditResourceId', org.id);
  ctx.set('auditDescription', `Organization "${org.name}" created in association "${association.name}"`);

  // [EM-M03-d1e2f3a4] Emit spec-declared OrganizationCreated event.
  domainEvents
    .emit('organization.created', {
      organizationId: org.id,
      associationId: body.associationId,
      name: org.name,
    })
    .catch(() => {});

  return ctx.json(org, 201);
}