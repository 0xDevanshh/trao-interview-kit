import { checkCoverage, type CoverageRequirement } from './checkCoverage.js';
import { categoriesForRequirement } from '../generation/generateQuestions.js';
import type { GeneratedQuestion, QuestionCategory, RequirementLike } from '../generation/generateQuestions.js';

export interface LoopRequirement extends RequirementLike {
  priority: 'must' | 'nice';
}

export type GenerateQuestionsFn = (
  requirement: RequirementLike,
  hiringProcessContext: string,
  category: QuestionCategory,
  options?: { startIndex?: number; count?: number },
) => Promise<GeneratedQuestion[]>;

export interface CoverageLoopPass {
  pass: number;
  requirementIds: string[];
}

export interface CoverageLoopResult {
  questions: GeneratedQuestion[];
  passes: number;
  uncovered_requirement_ids: string[];
  /** Which requirement ids triggered each extra pass, for debuggability. */
  gapsAddressedByPass: CoverageLoopPass[];
}

const DEFAULT_MAX_PASSES = 3;
const GAP_FILL_COUNT = 2;

function nextQuestionId(questions: GeneratedQuestion[]): number {
  let max = 0;
  for (const question of questions) {
    const match = /^q(\d+)$/.exec(question.id);
    if (match?.[1]) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

function mustHaveGapIds(requirements: LoopRequirement[], uncoveredIds: string[]): string[] {
  const mustIds = new Set(requirements.filter((r) => r.priority === 'must').map((r) => r.id));
  return uncoveredIds.filter((id) => mustIds.has(id));
}

export async function runCoverageLoop(
  requirements: LoopRequirement[],
  existingQuestions: GeneratedQuestion[],
  generateQuestionsForRequirement: GenerateQuestionsFn,
  hiringProcessContext: string,
  maxPasses: number = DEFAULT_MAX_PASSES,
): Promise<CoverageLoopResult> {
  let questions = existingQuestions;
  let passes = 0;
  const gapsAddressedByPass: CoverageLoopPass[] = [];

  const asCoverageRequirements: CoverageRequirement[] = requirements.map((r) => ({ id: r.id, priority: r.priority }));

  let coverage = checkCoverage(asCoverageRequirements, questions);
  let mustGaps = mustHaveGapIds(requirements, coverage.uncovered_requirement_ids);

  while (mustGaps.length > 0 && passes < maxPasses) {
    passes += 1;
    gapsAddressedByPass.push({ pass: passes, requirementIds: [...mustGaps] });

    let nextId = nextQuestionId(questions);
    const additions: GeneratedQuestion[] = [];

    for (const gapId of mustGaps) {
      const requirement = requirements.find((r) => r.id === gapId);
      if (!requirement) {
        continue; // Defensive: an id in uncovered_requirement_ids should always map back to a known requirement.
      }

      const [primaryCategory] = categoriesForRequirement(requirement.kind);
      const category: QuestionCategory = primaryCategory ?? 'technical';

      const generated = await generateQuestionsForRequirement(requirement, hiringProcessContext, category, {
        startIndex: nextId,
        count: GAP_FILL_COUNT,
      });

      additions.push(...generated);
      nextId += generated.length;
    }

    questions = [...questions, ...additions];
    coverage = checkCoverage(asCoverageRequirements, questions);
    mustGaps = mustHaveGapIds(requirements, coverage.uncovered_requirement_ids);
  }

  return {
    questions,
    passes,
    uncovered_requirement_ids: coverage.uncovered_requirement_ids,
    gapsAddressedByPass,
  };
}
