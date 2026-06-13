/**
 * Document repositories - Data access layer for document management.
 * Covers documents, versions, tags, and access logs.
 */

import { eq, and, or, ilike, desc, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  documents,
  documentVersions,
  documentTags,
  documentAccessLogs,
  type Document,
  type NewDocument,
  type DocumentVersion,
  type NewDocumentVersion,
  type DocumentTag,
  type NewDocumentTag,
  type DocumentAccessLog,
  type NewDocumentAccessLog,
} from './documents.schema';

// ---------------------------------------------------------------------------
// DocumentRepository
// ---------------------------------------------------------------------------

export interface DocumentFilters {
  organizationId?: string;
  ownerId?: string;
  ownerType?: string;
  accessLevel?: string;
  category?: string;
  status?: string;
  tag?: string;
  q?: string;
}

export class DocumentRepository extends DatabaseRepository<
  Document,
  NewDocument,
  DocumentFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, documents, logger);
  }

  protected buildWhereConditions(filters?: DocumentFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(documents.organizationId, filters.organizationId));
    }

    if (filters.ownerId) {
      conditions.push(eq(documents.ownerId, filters.ownerId));
    }

    if (filters.ownerType) {
      conditions.push(eq(documents.ownerType, filters.ownerType));
    }

    if (filters.accessLevel) {
      conditions.push(eq(documents.accessLevel, filters.accessLevel));
    }

    if (filters.category) {
      conditions.push(eq(documents.category, filters.category));
    }

    if (filters.status) {
      conditions.push(eq(documents.status, filters.status as Document['status']));
    }

    if (filters.tag) {
      // tags is a jsonb text[] column; match documents whose tags array
      // contains the requested tag (Postgres jsonb containment).
      conditions.push(sql`${documents.tags} @> ${JSON.stringify([filters.tag])}::jsonb`);
    }

    if (filters.q) {
      conditions.push(
        or(
          ilike(documents.title, `%${filters.q}%`),
          ilike(documents.fileName, `%${filters.q}%`)
        )
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// DocumentVersionRepository
// ---------------------------------------------------------------------------

export interface DocumentVersionFilters {
  documentId?: string;
  organizationId?: string;
}

export class DocumentVersionRepository extends DatabaseRepository<
  DocumentVersion,
  NewDocumentVersion,
  DocumentVersionFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, documentVersions, logger);
  }

  protected buildWhereConditions(filters?: DocumentVersionFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.documentId) {
      conditions.push(eq(documentVersions.documentId, filters.documentId));
    }

    if (filters.organizationId) {
      conditions.push(eq(documentVersions.organizationId, filters.organizationId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Get the latest version number for a document.
   */
  async getLatestVersionNumber(documentId: string): Promise<number> {
    const [latest] = await this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
      .limit(1);
    return latest ? latest.versionNumber : 0;
  }
}

// ---------------------------------------------------------------------------
// DocumentTagRepository
// ---------------------------------------------------------------------------

export interface DocumentTagFilters {
  organizationId?: string;
  q?: string;
}

export class DocumentTagRepository extends DatabaseRepository<
  DocumentTag,
  NewDocumentTag,
  DocumentTagFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, documentTags, logger);
  }

  protected buildWhereConditions(filters?: DocumentTagFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(documentTags.organizationId, filters.organizationId));
    }

    if (filters.q) {
      conditions.push(ilike(documentTags.name, `%${filters.q}%`));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// DocumentAccessLogRepository
// ---------------------------------------------------------------------------

export interface DocumentAccessLogFilters {
  documentId?: string;
  personId?: string;
}

export class DocumentAccessLogRepository extends DatabaseRepository<
  DocumentAccessLog,
  NewDocumentAccessLog,
  DocumentAccessLogFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, documentAccessLogs, logger);
  }

  protected buildWhereConditions(filters?: DocumentAccessLogFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.documentId) {
      conditions.push(eq(documentAccessLogs.documentId, filters.documentId));
    }

    if (filters.personId) {
      conditions.push(eq(documentAccessLogs.personId, filters.personId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
