// Pure allocation logic: no LLM call anywhere in this file. This function
// never drops a question and never invents one — it only decides which day
// each already-generated question lands on. Must-have coverage in the
// output is therefore only as complete as the input: if the caller didn't
// supply at least one question per must-have requirement, no amount of
// scheduling logic can fabricate that coverage without an LLM call, which
// is out of scope here by design.

export type RequirementPriority = 'must' | 'nice';

export interface ScheduleRequirement {
  id: string;
  priority: RequirementPriority;
}

export interface ScheduleQuestion {
  id: string;
  requirement_ids: string[];
  difficulty: 1 | 2 | 3;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

const MINUTES_BY_DIFFICULTY: Record<1 | 2 | 3, number> = {
  1: 10,
  2: 15,
  3: 20,
};

function buildPriorityIndex(requirements: ScheduleRequirement[]): Map<string, RequirementPriority> {
  const index = new Map<string, RequirementPriority>();
  for (const requirement of requirements) {
    index.set(requirement.id, requirement.priority);
  }
  return index;
}

/**
 * A question that touches any must-have requirement is treated as
 * must-priority as a whole, so it's never scheduled later than a question
 * that only supports nice-to-have requirements.
 */
function questionPriority(question: ScheduleQuestion, priorityById: Map<string, RequirementPriority>): RequirementPriority {
  const isMust = question.requirement_ids.some((id) => priorityById.get(id) === 'must');
  return isMust ? 'must' : 'nice';
}

function sortQuestions(
  questions: ScheduleQuestion[],
  priorityById: Map<string, RequirementPriority>,
): ScheduleQuestion[] {
  return [...questions].sort((a, b) => {
    const priorityA = questionPriority(a, priorityById);
    const priorityB = questionPriority(b, priorityById);

    if (priorityA !== priorityB) {
      return priorityA === 'must' ? -1 : 1;
    }

    return b.difficulty - a.difficulty;
  });
}

/**
 * A short theme string for the day, derived from the priority/difficulty
 * mix of the questions actually scheduled on it — this function only
 * receives {id, requirement_ids, difficulty}, not a requirement "kind" or
 * question "category", so those aren't available signals here.
 */
function deriveFocus(dayQuestions: ScheduleQuestion[], priorityById: Map<string, RequirementPriority>): string {
  if (dayQuestions.length === 0) {
    return 'Review';
  }

  const mustCount = dayQuestions.filter((q) => questionPriority(q, priorityById) === 'must').length;
  const mustRatio = mustCount / dayQuestions.length;
  const avgDifficulty = dayQuestions.reduce((sum, q) => sum + q.difficulty, 0) / dayQuestions.length;

  if (mustRatio >= 0.5 && avgDifficulty >= 2.5) {
    return 'Core must-haves (high difficulty)';
  }
  if (mustRatio >= 0.5) {
    return 'Core must-haves';
  }
  if (avgDifficulty >= 2.5) {
    return 'Challenging practice';
  }
  return 'Supplementary practice';
}

function minutesFor(dayQuestions: ScheduleQuestion[]): number {
  return dayQuestions.reduce((sum, q) => sum + MINUTES_BY_DIFFICULTY[q.difficulty], 0);
}

export function allocateSchedule(
  requirements: ScheduleRequirement[],
  questions: ScheduleQuestion[],
  daysAvailable: number,
): Schedule {
  if (!Number.isInteger(daysAvailable) || daysAvailable <= 0) {
    return { days_available: daysAvailable, days: [] };
  }

  const priorityById = buildPriorityIndex(requirements);
  const sorted = sortQuestions(questions, priorityById);

  const days: ScheduleDay[] = [];
  let cursor = 0;

  for (let day = 1; day <= daysAvailable; day += 1) {
    const remainingDays = daysAvailable - day + 1;
    const remainingQuestions = sorted.length - cursor;
    const take = remainingQuestions > 0 ? Math.ceil(remainingQuestions / remainingDays) : 0;

    const dayQuestions = sorted.slice(cursor, cursor + take);
    cursor += take;

    days.push({
      day,
      focus: deriveFocus(dayQuestions, priorityById),
      question_ids: dayQuestions.map((q) => q.id),
      minutes: minutesFor(dayQuestions),
    });
  }

  return { days_available: daysAvailable, days };
}
