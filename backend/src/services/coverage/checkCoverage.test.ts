import { checkCoverage } from './checkCoverage.js';

describe('checkCoverage', () => {
  it('flags a requirement with no matching question', () => {
    const requirements = [
      { id: 'r1', priority: 'must' as const },
      { id: 'r2', priority: 'nice' as const },
    ];
    const questions = [{ requirement_ids: ['r1'] }];

    const result = checkCoverage(requirements, questions);

    expect(result.uncovered_requirement_ids).toEqual(['r2']);
  });

  it('does not flag a requirement that has a matching question', () => {
    const requirements = [{ id: 'r1', priority: 'must' as const }];
    const questions = [{ requirement_ids: ['r1', 'r2'] }];

    const result = checkCoverage(requirements, questions);

    expect(result.uncovered_requirement_ids).toEqual([]);
  });

  it('flags every requirement when there are no questions at all', () => {
    const requirements = [
      { id: 'r1', priority: 'must' as const },
      { id: 'r2', priority: 'must' as const },
    ];

    const result = checkCoverage(requirements, []);

    expect(result.uncovered_requirement_ids).toEqual(['r1', 'r2']);
  });
});
