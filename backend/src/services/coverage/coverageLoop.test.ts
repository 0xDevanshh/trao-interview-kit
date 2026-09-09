import { jest } from '@jest/globals';
import { runCoverageLoop, type LoopRequirement } from './coverageLoop.js';
import type { GeneratedQuestion } from '../generation/generateQuestions.js';

function question(id: string, requirementId: string): GeneratedQuestion {
  return {
    id,
    requirement_ids: [requirementId],
    category: 'technical',
    prompt: 'placeholder prompt',
    answer_outline: 'placeholder outline',
    difficulty: 1,
  };
}

const requirements: LoopRequirement[] = [{ id: 'r1', text: 'Knows Node.js', kind: 'technical', priority: 'must' }];

describe('runCoverageLoop', () => {
  it('keeps retrying until coverage closes, reporting the passes it took', async () => {
    const generateQuestionsForRequirement = jest
      .fn<
        (
          requirement: LoopRequirement,
          hiringProcessContext: string,
          category: string,
          options?: { startIndex?: number; count?: number },
        ) => Promise<GeneratedQuestion[]>
      >()
      // Pass 1: the model returns a question that doesn't actually cover r1.
      .mockResolvedValueOnce([question('q_gap1', 'unrelated')])
      // Pass 2: the model finally returns a question covering r1.
      .mockResolvedValueOnce([question('q_gap2', 'r1')]);

    const result = await runCoverageLoop(requirements, [], generateQuestionsForRequirement, '', 3);

    expect(result.passes).toBe(2);
    expect(result.uncovered_requirement_ids).toEqual([]);
    expect(generateQuestionsForRequirement).toHaveBeenCalledTimes(2);
    expect(result.gapsAddressedByPass).toEqual([
      { pass: 1, requirementIds: ['r1'] },
      { pass: 2, requirementIds: ['r1'] },
    ]);
    expect(result.questions.map((q) => q.id)).toEqual(['q_gap1', 'q_gap2']);
  });

  it('stops at maxPasses and reports the gap honestly instead of throwing', async () => {
    const generateQuestionsForRequirement = jest
      .fn<
        (
          requirement: LoopRequirement,
          hiringProcessContext: string,
          category: string,
          options?: { startIndex?: number; count?: number },
        ) => Promise<GeneratedQuestion[]>
      >()
      .mockResolvedValue([question('q_never', 'unrelated')]);

    const result = await runCoverageLoop(requirements, [], generateQuestionsForRequirement, '', 2);

    expect(result.passes).toBe(2);
    expect(result.uncovered_requirement_ids).toEqual(['r1']);
    expect(generateQuestionsForRequirement).toHaveBeenCalledTimes(2);
  });
});
