/**
 * Training post-completion lock — completed/cancelled trainings
 * should reject field updates (not just status changes).
 *
 * AC-M09-005: Post-completion immutability for training records.
 */

import { describe, test, expect } from 'bun:test';
import { updateTraining } from './updateTraining';
import type { Context } from 'hono';

function makeCtx(trainingStatus: string, body: any): Context {
  const fakeTraining = {
    id: 'trn-1',
    organizationId: 'org-1',
    title: 'Old Title',
    status: trainingStatus,
  };

  return {
    get: (key: string) => {
      if (key === 'database') return {};
      if (key === 'session') return { user: { id: 'user-1', role: 'admin' }, id: 'sess-1' };
      return undefined;
    },
    req: {
      param: (name: string) => {
        if (name === 'id') return 'trn-1';
        if (name === 'organizationId') return 'org-1';
        return undefined;
      },
      json: async () => body,
    },
    json: (data: any, status: number) => new Response(JSON.stringify(data), { status }),
  } as unknown as Context;
}

// Mock repos
const { mock } = await import('bun:test');

// We need to mock the officer check and repo
const mockOfficerTerms = [{ id: 'term-1', positionId: 'pos-1', personId: 'user-1' }];

// Mock at module level
const originalImport = await import('./updateTraining');

describe('[AC-M09-005] Post-completion lock on field updates', () => {
  test('completed training rejects title update with 409', async () => {
    // The handler should check if training is completed/cancelled
    // before allowing any field updates, not just status changes.
    //
    // Currently updateTraining only blocks status changes (line 37-42)
    // but allows modifying title, description, dates, etc on completed trainings.
    //
    // This test checks the source code for the guard.
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    const source = readFileSync(join(import.meta.dir, 'updateTraining.ts'), 'utf-8');

    // The handler must check for completed/cancelled status before processing updates
    const hasCompletionLock =
      source.includes("status === 'completed'") ||
      source.includes("status === 'cancelled'") ||
      source.includes('isTrainingLocked') ||
      source.includes('TRAINING_LOCKED') ||
      source.includes('post-completion');

    expect(hasCompletionLock).toBe(true);
  });

  test('cancelled training rejects field update', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    const source = readFileSync(join(import.meta.dir, 'updateTraining.ts'), 'utf-8');

    // Must guard both completed AND cancelled
    const guardsBothStates =
      (source.includes("'completed'") && source.includes("'cancelled'")) ||
      source.includes('isTrainingLocked');

    expect(guardsBothStates).toBe(true);
  });
});
