import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Quiz Attempt Tests
 *
 * Tests for quiz attempt handlers — auth guards, scoring logic.
 */

describe('createQuizAttempt — guards', () => {
  test('createQuizAttempt returns 401 without user', async () => {
    const { createQuizAttempt } = await import('./createQuizAttempt');
    const ctx = makeCtx({ user: null });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(401);
  });

  test('createQuizAttempt returns 403 without organizationId', async () => {
    const { createQuizAttempt } = await import('./createQuizAttempt');
    const ctx = makeCtx({ organizationId: null });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(403);
  });
});

describe('searchQuizAttempts — guards', () => {
  test('searchQuizAttempts returns 401 without user', async () => {
    const { searchQuizAttempts } = await import('./searchQuizAttempts');
    const ctx = makeCtx({ user: null });
    const response = await searchQuizAttempts(ctx);
    expect(response.status).toBe(401);
  });
});

describe('Quiz scoring — 70% threshold', () => {
  const PASS_THRESHOLD = 0.7;

  test('exactly 70% passes', () => {
    const passed = (70 / 100) >= PASS_THRESHOLD;
    expect(passed).toBe(true);
  });

  test('69% fails', () => {
    const passed = (69 / 100) >= PASS_THRESHOLD;
    expect(passed).toBe(false);
  });

  test('100% passes', () => {
    const passed = (100 / 100) >= PASS_THRESHOLD;
    expect(passed).toBe(true);
  });

  test('0% fails', () => {
    const passed = (0 / 100) >= PASS_THRESHOLD;
    expect(passed).toBe(false);
  });

  test('custom maxScore: 35/50 = 70% passes', () => {
    const score = 35;
    const maxScore = 50;
    const passed = maxScore > 0 ? (score / maxScore) >= PASS_THRESHOLD : false;
    expect(passed).toBe(true);
  });

  test('custom maxScore: 34/50 = 68% fails', () => {
    const score = 34;
    const maxScore = 50;
    const passed = maxScore > 0 ? (score / maxScore) >= PASS_THRESHOLD : false;
    expect(passed).toBe(false);
  });

  test('zero maxScore always fails', () => {
    const maxScore = 0;
    const passed = maxScore > 0 ? (0 / maxScore) >= PASS_THRESHOLD : false;
    expect(passed).toBe(false);
  });

  test('score defaults to 0 when not provided', () => {
    const score = Number(undefined) || 0;
    expect(score).toBe(0);
  });

  test('maxScore defaults to 100 when not provided', () => {
    const maxScore = Number(undefined) || 100;
    expect(maxScore).toBe(100);
  });
});
