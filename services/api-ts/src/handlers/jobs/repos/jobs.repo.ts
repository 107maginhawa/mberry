import { eq, and, desc, gte, lte, like, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { escapeLikePattern } from '@/utils/sanitize';
import { NotFoundError, ValidationError } from '@/core/errors';
import {
  jobPostings,
  jobApplications,
  type JobPosting,
  type NewJobPosting,
  type JobApplication,
  type NewJobApplication,
} from './jobs.schema';

const DEFAULT_EXPIRY_DAYS = 30;

export class JobPostingRepository {
  constructor(private db: DatabaseInstance) {}

  async list(
    filters?: {
      organizationId?: string;
      status?: string;
      type?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions: SQL<unknown>[] = [];
    if (filters?.organizationId) {
      conditions.push(eq(jobPostings.organizationId, filters.organizationId));
    }
    if (filters?.status) {
      conditions.push(eq(jobPostings.status, filters.status as JobPosting['status']));
    }
    if (filters?.type) {
      conditions.push(eq(jobPostings.type, filters.type as JobPosting['type']));
    }
    if (filters?.search) {
      conditions.push(like(jobPostings.title, `%${escapeLikePattern(filters.search)}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(jobPostings)
        .where(where)
        .orderBy(desc(jobPostings.createdAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobPostings)
        .where(where),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<JobPosting | undefined> {
    const [posting] = await this.db
      .select()
      .from(jobPostings)
      .where(eq(jobPostings.id, id))
      .limit(1);
    return posting;
  }

  async create(data: NewJobPosting): Promise<JobPosting> {
    // Auto-set expiresAt if not provided (BR-37: 30-day default)
    if (!data.expiresAt && data.postedAt) {
      const expires = new Date(data.postedAt);
      expires.setDate(expires.getDate() + DEFAULT_EXPIRY_DAYS);
      data = { ...data, expiresAt: expires };
    }
    const [result] = await this.db.insert(jobPostings).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<JobPosting>): Promise<JobPosting> {
    const [result] = await this.db
      .update(jobPostings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobPostings.id, id))
      .returning();
    return result!;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(jobPostings)
      .where(eq(jobPostings.id, id))
      .returning();
    return result.length > 0;
  }

  async listExpired(now: Date): Promise<JobPosting[]> {
    return this.db
      .select()
      .from(jobPostings)
      .where(
        and(
          eq(jobPostings.status, 'active'),
          lte(jobPostings.expiresAt, now),
        ),
      )
      .limit(200);
  }

  async extendPosting(id: string, days: number = DEFAULT_EXPIRY_DAYS): Promise<JobPosting> {
    const posting = await this.get(id);
    if (!posting) throw new NotFoundError('Posting not found', { resourceType: 'JobPosting', resource: id });
    if (!posting.expiresAt) throw new ValidationError('Posting has no expiry date');

    // BR-37: Extension resets from CURRENT expiry date, not from today
    const newExpiry = new Date(posting.expiresAt);
    newExpiry.setDate(newExpiry.getDate() + days);

    return this.update(id, { expiresAt: newExpiry, status: 'active' });
  }
}

export class JobApplicationRepository {
  constructor(private db: DatabaseInstance) {}

  async list(
    filters?: {
      postingId?: string;
      personId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions: SQL<unknown>[] = [];
    if (filters?.postingId) {
      conditions.push(eq(jobApplications.postingId, filters.postingId));
    }
    if (filters?.personId) {
      conditions.push(eq(jobApplications.personId, filters.personId));
    }
    if (filters?.status) {
      conditions.push(eq(jobApplications.status, filters.status as JobApplication['status']));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(jobApplications)
        .where(where)
        .orderBy(desc(jobApplications.appliedAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobApplications)
        .where(where),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<JobApplication | undefined> {
    const [app] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, id))
      .limit(1);
    return app;
  }

  async create(data: NewJobApplication): Promise<JobApplication> {
    const [result] = await this.db.insert(jobApplications).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<JobApplication>): Promise<JobApplication> {
    const [result] = await this.db
      .update(jobApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobApplications.id, id))
      .returning();
    return result!;
  }

  async findByPersonAndPosting(personId: string, postingId: string): Promise<JobApplication | undefined> {
    const [app] = await this.db
      .select()
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.personId, personId),
          eq(jobApplications.postingId, postingId),
        ),
      )
      .limit(1);
    return app;
  }
}
