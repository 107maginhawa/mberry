import { eq, and, desc, lte, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  committeeTasks,
  type CommitteeTask,
  type NewCommitteeTask,
} from './committee-task.schema';

export class CommitteeTaskRepository {
  constructor(private db: DatabaseInstance) {}

  async list(committeeId: string): Promise<CommitteeTask[]> {
    return this.db
      .select()
      .from(committeeTasks)
      .where(eq(committeeTasks.committeeId, committeeId))
      .orderBy(desc(committeeTasks.createdAt));
  }

  async get(id: string): Promise<CommitteeTask | undefined> {
    const [result] = await this.db
      .select()
      .from(committeeTasks)
      .where(eq(committeeTasks.id, id))
      .limit(1);
    return result;
  }

  async create(data: NewCommitteeTask): Promise<CommitteeTask> {
    const [result] = await this.db.insert(committeeTasks).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<CommitteeTask>): Promise<CommitteeTask> {
    const [result] = await this.db
      .update(committeeTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(committeeTasks.id, id))
      .returning();
    return result!;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(committeeTasks)
      .where(eq(committeeTasks.id, id));
  }

  async updateStatus(id: string, status: string, completedBy?: string): Promise<CommitteeTask> {
    const updates: Partial<CommitteeTask> = {
      status: status as CommitteeTask['status'],
      updatedAt: new Date(),
    };
    if (status === 'completed') {
      updates.completedAt = new Date();
      updates.completedBy = completedBy ?? null;
    }
    const [result] = await this.db
      .update(committeeTasks)
      .set(updates)
      .where(eq(committeeTasks.id, id))
      .returning();
    return result!;
  }

  async assignTo(id: string, assigneeId: string): Promise<CommitteeTask> {
    const [result] = await this.db
      .update(committeeTasks)
      .set({ assigneeId, updatedAt: new Date() })
      .where(eq(committeeTasks.id, id))
      .returning();
    return result!;
  }

  async listOverdue(committeeId: string): Promise<CommitteeTask[]> {
    return this.db
      .select()
      .from(committeeTasks)
      .where(and(
        eq(committeeTasks.committeeId, committeeId),
        eq(committeeTasks.status, 'pending'),
        lte(committeeTasks.dueDate, new Date()),
      ))
      .orderBy(committeeTasks.dueDate);
  }

  async listByAssignee(assigneeId: string): Promise<CommitteeTask[]> {
    return this.db
      .select()
      .from(committeeTasks)
      .where(and(
        eq(committeeTasks.assigneeId, assigneeId),
        eq(committeeTasks.status, 'pending'),
      ))
      .orderBy(committeeTasks.dueDate);
  }
}
