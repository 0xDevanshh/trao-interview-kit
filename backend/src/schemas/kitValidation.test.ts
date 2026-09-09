import { validateKitStructure } from './kitValidation.js';
import type { Kit } from './kitSchema.js';

function buildValidKit(): Kit {
  return {
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.example.com',
      role: 'Backend Engineer',
      location: 'Remote',
      jd_chars: 1200,
      researched_at: '2026-01-01T00:00:00.000Z',
      pages_used: ['https://acme.example.com/careers'],
    },
    company_brief: {
      summary: 'Acme builds widgets.',
      what_they_do: 'Widget manufacturing platform.',
      sources: ['https://acme.example.com/about'],
    },
    role: {
      title: 'Backend Engineer',
      seniority: 'Mid',
      responsibilities: ['Build APIs'],
      requirements: [
        { id: 'req-1', text: 'Knows Node.js', kind: 'technical', priority: 'must' },
        { id: 'req-2', text: 'Team player', kind: 'behavioural', priority: 'nice' },
      ],
    },
    questions: [
      {
        id: 'q-1',
        requirement_ids: ['req-1'],
        category: 'technical',
        prompt: 'Explain event loop.',
        answer_outline: 'Cover phases of the event loop.',
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: 'fc-1',
        front: 'What is Node.js?',
        back: 'A JS runtime built on V8.',
        requirement_ids: ['req-1'],
      },
    ],
    schedule: {
      days_available: 3,
      days: [{ day: 1, focus: 'Fundamentals', question_ids: ['q-1'], minutes: 60 }],
    },
    coverage: {
      uncovered_requirement_ids: ['req-2'],
      passes: 1,
    },
  };
}

describe('validateKitStructure', () => {
  it('accepts a well-formed kit', () => {
    const result = validateKitStructure(buildValidKit());
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects a question referencing a nonexistent requirement id', () => {
    const kit = buildValidKit();
    kit.questions[0]!.requirement_ids = ['req-does-not-exist'];

    const result = validateKitStructure(kit);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((message) => message.includes('req-does-not-exist'))).toBe(true);
  });

  it('rejects a float in minutes', () => {
    const kit = buildValidKit();
    (kit.schedule.days[0] as { minutes: number }).minutes = 45.5;

    const result = validateKitStructure(kit);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((message) => message.includes('minutes'))).toBe(true);
  });
});
