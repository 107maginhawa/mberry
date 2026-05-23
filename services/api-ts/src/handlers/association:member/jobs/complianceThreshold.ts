import type { JobContext } from '@/core/jobs';

export async function processComplianceThreshold(context: JobContext): Promise<void> {
  const { logger, data } = context;
  const payload = data as { personId: string; organizationId: string; totalCredits: number; requiredCredits: number };
  if (!payload.personId || !payload.organizationId) { logger.error({ payload }, 'compliance.threshold_met: missing fields'); return; }
  logger.info({ personId: payload.personId, totalCredits: payload.totalCredits, requiredCredits: payload.requiredCredits }, 'compliance.threshold_met: threshold reached');
}
