import { eq, and, desc, like, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  trainings,
  trainingEnrollments,
  type Training,
  type NewTraining,
  type TrainingEnrollment,
  type NewTrainingEnrollment,
} from '../../association:operations/repos/training.schema';

export class TrainingRepository {
  constructor(private db: DatabaseInstance) {}

  async list(
    orgId: string,
    filters?: {
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions: SQL<unknown>[] = [
      eq(trainings.organizationId, orgId),
    ];
    if (filters?.status) conditions.push(eq(trainings.status, filters.status as any));
    if (filters?.search) conditions.push(like(trainings.title, `%${filters.search}%`));

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(trainings)
        .where(and(...conditions))
        .orderBy(desc(trainings.startDate))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainings)
        .where(and(...conditions)),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<Training | undefined> {
    const [training] = await this.db.select().from(trainings).where(eq(trainings.id, id)).limit(1);
    return training;
  }

  /** Get training only if it belongs to the specified org. Returns undefined otherwise. */
  async getByOrg(id: string, orgId: string): Promise<Training | undefined> {
    const [training] = await this.db
      .select()
      .from(trainings)
      .where(and(eq(trainings.id, id), eq(trainings.organizationId, orgId)))
      .limit(1);
    return training;
  }

  async create(data: NewTraining): Promise<Training> {
    const [result] = await this.db.insert(trainings).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<Training>): Promise<Training> {
    const [result] = await this.db
      .update(trainings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainings.id, id))
      .returning();
    return result!;
  }

  async getStats(orgId: string) {
    const quarterStart = new Date();
    quarterStart.setMonth(quarterStart.getMonth() - 3);
    const [stats] = await this.db
      .select({
        totalThisQuarter: sql<number>`count(CASE WHEN ${trainings.startDate} >= ${quarterStart} THEN 1 END)::int`,
        totalEnrollments: sql<number>`0::int`,
      })
      .from(trainings)
      .where(eq(trainings.organizationId, orgId));
    return stats;
  }

  // Enrollments
  async listEnrollments(trainingId: string) {
    return this.db
      .select()
      .from(trainingEnrollments)
      .where(eq(trainingEnrollments.trainingId, trainingId))
      .orderBy(trainingEnrollments.createdAt);
  }

  async enroll(data: NewTrainingEnrollment): Promise<TrainingEnrollment> {
    const [result] = await this.db.insert(trainingEnrollments).values(data).returning();
    return result!;
  }

  async getAttendanceStats(trainingId: string) {
    const [stats] = await this.db
      .select({
        completed: sql<number>`count(CASE WHEN ${trainingEnrollments.status} = 'completed' THEN 1 END)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(trainingEnrollments)
      .where(eq(trainingEnrollments.trainingId, trainingId));
    return stats;
  }

  async getEnrollmentCount(trainingId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(trainingEnrollments)
      .where(
        and(
          eq(trainingEnrollments.trainingId, trainingId),
          eq(trainingEnrollments.status, 'enrolled'),
        ),
      );
    return result?.count ?? 0;
  }

  async updateEnrollmentStatus(id: string, status: string): Promise<TrainingEnrollment> {
    const [result] = await this.db
      .update(trainingEnrollments)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(trainingEnrollments.id, id))
      .returning();
    return result!;
  }

  // Member view
  async listByPerson(personId: string) {
    return this.db
      .select({ enrollment: trainingEnrollments, training: trainings })
      .from(trainingEnrollments)
      .innerJoin(trainings, eq(trainingEnrollments.trainingId, trainings.id))
      .where(eq(trainingEnrollments.personId, personId))
      .orderBy(desc(trainings.startDate));
  }
}
