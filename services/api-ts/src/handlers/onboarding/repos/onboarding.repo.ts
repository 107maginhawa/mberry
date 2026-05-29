/**
 * Repository for the resumable onboarding wizard state.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import {
  onboardingStates,
  type NewOnboardingState,
  type OnboardingState,
} from './onboarding.schema';

export class OnboardingStateRepository {
  constructor(
    private db: NodePgDatabase,
    private logger?: Logger,
  ) {}

  async findByOrg(orgId: string): Promise<OnboardingState | undefined> {
    const [row] = await this.db
      .select()
      .from(onboardingStates)
      .where(eq(onboardingStates.organizationId, orgId))
      .limit(1);
    return row;
  }

  async create(data: NewOnboardingState): Promise<OnboardingState> {
    const [row] = await this.db
      .insert(onboardingStates)
      .values(data)
      .returning();
    return row!;
  }

  async update(
    orgId: string,
    data: Partial<Pick<OnboardingState, 'currentStep' | 'stepsCompleted' | 'completedAt'>>,
  ): Promise<OnboardingState | undefined> {
    const [row] = await this.db
      .update(onboardingStates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingStates.organizationId, orgId))
      .returning();
    return row;
  }
}
