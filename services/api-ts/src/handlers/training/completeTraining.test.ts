import { describe, test, expect } from 'bun:test';
import { TRAINING_VALID_TRANSITIONS, isValidTrainingTransition } from './completeTraining';

describe('Training VALID_TRANSITIONS state machine', () => {
  test('draft can transition to published or cancelled', () => {
    expect(TRAINING_VALID_TRANSITIONS['draft']).toEqual(['published', 'cancelled']);
  });

  test('published can transition to completed or cancelled', () => {
    expect(TRAINING_VALID_TRANSITIONS['published']).toEqual(['completed', 'cancelled']);
  });

  test('completed is terminal', () => {
    expect(TRAINING_VALID_TRANSITIONS['completed']).toEqual([]);
  });

  test('cancelled is terminal', () => {
    expect(TRAINING_VALID_TRANSITIONS['cancelled']).toEqual([]);
  });

  test('isValidTrainingTransition returns true for valid transitions', () => {
    expect(isValidTrainingTransition('draft', 'published')).toBe(true);
    expect(isValidTrainingTransition('draft', 'cancelled')).toBe(true);
    expect(isValidTrainingTransition('published', 'completed')).toBe(true);
    expect(isValidTrainingTransition('published', 'cancelled')).toBe(true);
  });

  test('isValidTrainingTransition returns false for invalid transitions', () => {
    expect(isValidTrainingTransition('draft', 'completed')).toBe(false);
    expect(isValidTrainingTransition('completed', 'published')).toBe(false);
    expect(isValidTrainingTransition('cancelled', 'draft')).toBe(false);
    expect(isValidTrainingTransition('completed', 'cancelled')).toBe(false);
  });

  test('isValidTrainingTransition returns false for unknown status', () => {
    expect(isValidTrainingTransition('unknown', 'published')).toBe(false);
  });
});
