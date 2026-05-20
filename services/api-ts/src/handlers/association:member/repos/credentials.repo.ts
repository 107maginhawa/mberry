/**
 * CredentialTemplateRepository & DigitalCredentialRepository
 * Data access layer for credential templates and digital credentials.
 */

import { eq, and, ilike, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  credentialTemplates,
  digitalCredentials,
  type CredentialTemplate,
  type NewCredentialTemplate,
  type DigitalCredential,
  type NewDigitalCredential,
} from './credentials.schema';

// ---------------------------------------------------------------------------
// CredentialTemplateRepository
// ---------------------------------------------------------------------------

export interface CredentialTemplateFilters {
  organizationId?: string;
  type?: string;
  status?: string;
  q?: string;
}

export class CredentialTemplateRepository extends DatabaseRepository<
  CredentialTemplate,
  NewCredentialTemplate,
  CredentialTemplateFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, credentialTemplates, logger);
  }

  protected buildWhereConditions(filters?: CredentialTemplateFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(credentialTemplates.organizationId, filters.organizationId));
    }

    if (filters.type) {
      conditions.push(eq(credentialTemplates.type, filters.type as CredentialTemplate['type']));
    }

    if (filters.status) {
      conditions.push(eq(credentialTemplates.status, filters.status as CredentialTemplate['status']));
    }

    if (filters.q) {
      conditions.push(ilike(credentialTemplates.name, `%${filters.q}%`));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// DigitalCredentialRepository
// ---------------------------------------------------------------------------

export interface DigitalCredentialFilters {
  organizationId?: string;
  personId?: string;
  templateId?: string;
  status?: string;
  q?: string;
}

export class DigitalCredentialRepository extends DatabaseRepository<
  DigitalCredential,
  NewDigitalCredential,
  DigitalCredentialFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, digitalCredentials, logger);
  }

  protected buildWhereConditions(filters?: DigitalCredentialFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(digitalCredentials.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(digitalCredentials.personId, filters.personId));
    }

    if (filters.templateId) {
      conditions.push(eq(digitalCredentials.templateId, filters.templateId));
    }

    if (filters.status) {
      conditions.push(eq(digitalCredentials.status, filters.status as DigitalCredential['status']));
    }

    if (filters.q) {
      conditions.push(ilike(digitalCredentials.credentialNumber, `%${filters.q}%`));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find a credential by its HMAC verification token (qrPayload field).
   */
  async findByQrPayload(token: string): Promise<DigitalCredential | null> {
    const [record] = await this.db
      .select()
      .from(digitalCredentials)
      .where(eq(digitalCredentials.qrPayload, token))
      .limit(1);
    return (record as DigitalCredential) || null;
  }
}
