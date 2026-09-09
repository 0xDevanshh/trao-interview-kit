import { allocateSchedule, type ScheduleQuestion, type ScheduleRequirement } from './allocateSchedule.js';

function sampleRequirements(): ScheduleRequirement[] {
  return [
    { id: 'r1', priority: 'must' },
    { id: 'r2', priority: 'must' },
    { id: 'r3', priority: 'nice' },
    { id: 'r4', priority: 'nice' },
  ];
}

function sampleQuestions(): ScheduleQuestion[] {
  return [
    { id: 'q1', requirement_ids: ['r1'], difficulty: 3 },
    { id: 'q2', requirement_ids: ['r1'], difficulty: 2 },
    { id: 'q3', requirement_ids: ['r2'], difficulty: 3 },
    { id: 'q4', requirement_ids: ['r3'], difficulty: 1 },
    { id: 'q5', requirement_ids: ['r3'], difficulty: 2 },
    { id: 'q6', requirement_ids: ['r4'], difficulty: 1 },
    { id: 'q7', requirement_ids: ['r4'], difficulty: 1 },
    { id: 'q8', requirement_ids: ['r2'], difficulty: 2 },
    { id: 'q9', requirement_ids: ['r3'], difficulty: 1 },
    { id: 'q10', requirement_ids: ['r4'], difficulty: 2 },
  ];
}

function findDayForQuestion(days: ReturnType<typeof allocateSchedule>['days'], questionId: string): number {
  const day = days.find((d) => d.question_ids.includes(questionId));
  if (!day) {
    throw new Error(`Question ${questionId} was not scheduled on any day`);
  }
  return day.day;
}

describe('allocateSchedule', () => {
  it.each([1, 5, 60])('produces every day from 1..N for daysAvailable=%d', (n) => {
    const result = allocateSchedule(sampleRequirements(), sampleQuestions(), n);

    expect(result.days_available).toBe(n);
    expect(result.days).toHaveLength(n);
    expect(result.days.map((d) => d.day)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });

  it('never drops or duplicates a question across days', () => {
    const questions = sampleQuestions();
    const result = allocateSchedule(sampleRequirements(), questions, 4);

    const allScheduledIds = result.days.flatMap((d) => d.question_ids);
    expect(new Set(allScheduledIds).size).toBe(allScheduledIds.length); // no duplicates
    expect([...allScheduledIds].sort()).toEqual(questions.map((q) => q.id).sort());
  });

  it('covers every must-have requirement with at least one scheduled question', () => {
    const requirements = sampleRequirements();
    const questions = sampleQuestions();
    const result = allocateSchedule(requirements, questions, 3);

    const scheduledIds = new Set(result.days.flatMap((d) => d.question_ids));
    const scheduledRequirementIds = new Set(
      questions.filter((q) => scheduledIds.has(q.id)).flatMap((q) => q.requirement_ids),
    );

    const mustHaveIds = requirements.filter((r) => r.priority === 'must').map((r) => r.id);
    for (const mustId of mustHaveIds) {
      expect(scheduledRequirementIds.has(mustId)).toBe(true);
    }
  });

  it.each([1, 5, 60])('always produces integer minutes for daysAvailable=%d', (n) => {
    const result = allocateSchedule(sampleRequirements(), sampleQuestions(), n);

    for (const day of result.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
    }
  });

  it('schedules a must-have high-difficulty question no later than a nice-to-have low-difficulty question', () => {
    const requirements: ScheduleRequirement[] = [
      { id: 'rMust', priority: 'must' },
      { id: 'rNice', priority: 'nice' },
    ];
    const questions: ScheduleQuestion[] = [
      { id: 'qHard', requirement_ids: ['rMust'], difficulty: 3 },
      { id: 'qEasy', requirement_ids: ['rNice'], difficulty: 1 },
    ];

    const result = allocateSchedule(requirements, questions, 2);

    const hardDay = findDayForQuestion(result.days, 'qHard');
    const easyDay = findDayForQuestion(result.days, 'qEasy');

    expect(hardDay).toBeLessThanOrEqual(easyDay);
  });

  it('crams everything into a single day when daysAvailable is 1', () => {
    const questions = sampleQuestions();
    const result = allocateSchedule(sampleRequirements(), questions, 1);

    expect(result.days).toHaveLength(1);
    expect(result.days[0]!.question_ids).toHaveLength(questions.length);
  });

  it('spreads thin over many days without inventing extra content', () => {
    const questions = sampleQuestions(); // 10 questions
    const result = allocateSchedule(sampleRequirements(), questions, 60);

    expect(result.days).toHaveLength(60);

    const nonEmptyDays = result.days.filter((d) => d.question_ids.length > 0);
    const emptyDays = result.days.filter((d) => d.question_ids.length === 0);

    // No fabricated content: at most one question per day once spread this thin.
    expect(nonEmptyDays.every((d) => d.question_ids.length <= 1)).toBe(true);
    expect(nonEmptyDays.length).toBeLessThanOrEqual(questions.length);
    expect(emptyDays.length).toBeGreaterThan(0);
    for (const day of emptyDays) {
      expect(day.focus).toBe('Review');
      expect(day.minutes).toBe(0);
    }
  });
});
