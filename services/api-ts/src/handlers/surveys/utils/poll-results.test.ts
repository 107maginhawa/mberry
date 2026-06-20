import { describe, test, expect } from 'bun:test';
import { aggregatePollResults } from './poll-results';

const poll: any = {
  questions: [{ id: 'q1', type: 'single_choice', text: 'Pick', options: ['A', 'B'] }],
};

describe('aggregatePollResults', () => {
  test('counts votes by option label, omits zero-vote options', () => {
    const responses: any = [
      { answers: [{ questionId: 'q1', value: 'A' }] },
      { answers: [{ questionId: 'q1', value: 'A' }] },
    ];
    const [r] = aggregatePollResults(poll, responses);
    expect(r.questionId).toBe('q1');
    expect(r.counts).toEqual({ A: 2 });
    expect(r.total).toBe(2);
  });

  test('handles array (multi_choice) answers and empty responses', () => {
    const [empty] = aggregatePollResults(poll, []);
    expect(empty.total).toBe(0);
    const [multi] = aggregatePollResults(poll, [{ answers: [{ questionId: 'q1', value: ['A', 'B'] }] }] as any);
    expect(multi.counts).toEqual({ A: 1, B: 1 });
    expect(multi.total).toBe(2);
  });
});
