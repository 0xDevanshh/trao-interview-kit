// Pure set logic: no LLM call anywhere in this file.

export interface CoverageRequirement {
  id: string;
  priority: 'must' | 'nice';
}

export interface CoverageQuestion {
  requirement_ids: string[];
}

export interface CoverageResult {
  uncovered_requirement_ids: string[];
}

/**
 * Returns every requirement id (regardless of priority) that no question's
 * requirement_ids array references. Callers typically only act on the
 * "must" subset of this, but the check itself doesn't discriminate — a
 * "nice" gap is just as real, it's just not necessarily worth a retry pass.
 */
export function checkCoverage(requirements: CoverageRequirement[], questions: CoverageQuestion[]): CoverageResult {
  const coveredIds = new Set<string>();
  for (const question of questions) {
    for (const id of question.requirement_ids) {
      coveredIds.add(id);
    }
  }

  const uncovered_requirement_ids = requirements
    .filter((requirement) => !coveredIds.has(requirement.id))
    .map((requirement) => requirement.id);

  return { uncovered_requirement_ids };
}
