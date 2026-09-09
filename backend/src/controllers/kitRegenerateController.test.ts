import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

function buildFixtureKit() {
  return {
    _id: '507f1f77bcf86cd799439011',
    ownerId: 'owner-1',
    status: 'ready',
    error: null,
    _retrievalCache: { company_pages: [], discussion_snippets: [] },
    source: {
      company: 'Acme',
      company_url: 'https://acme.example.com',
      role: 'Backend Engineer',
      location: '',
      jd_chars: 10,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: { summary: 's', what_they_do: 'w', sources: [] },
    role: {
      title: 'Backend Engineer',
      seniority: 'Mid',
      responsibilities: [],
      requirements: [
        { id: 'r1', text: 'Node.js', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'PostgreSQL', kind: 'technical', priority: 'must' },
        { id: 'r3', text: 'Communication', kind: 'behavioural', priority: 'nice' },
      ],
    },
    questions: [
      // Locked: user-edited, covers r1. Must survive untouched.
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'Edited prompt', answer_outline: 'A1', difficulty: 2, source: 'edited' },
      // Unlocked: generated, covers r1 too (redundantly with q1).
      { id: 'q2', requirement_ids: ['r1'], category: 'technical', prompt: 'P2', answer_outline: 'A2', difficulty: 1, source: 'generated' },
      // Unlocked: generated, covers r2 — the ONLY requirement left uncovered
      // in this category once q2/q3 are discarded (q1 already covers r1).
      { id: 'q3', requirement_ids: ['r2'], category: 'technical', prompt: 'P3', answer_outline: 'A3', difficulty: 3, source: 'generated' },
      // A different category entirely — must be completely untouched.
      { id: 'q4', requirement_ids: ['r3'], category: 'behavioural', prompt: 'P4', answer_outline: 'A4', difficulty: 1, source: 'generated' },
    ],
    flashcards: [],
    schedule: { days_available: 1, days: [{ day: 1, focus: 'Core', question_ids: ['q1', 'q4'], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    save: jest.fn(async function save(this: unknown) {
      return this;
    }),
  };
}

type FixtureKit = ReturnType<typeof buildFixtureKit>;

let fixture: FixtureKit;

const findById = jest.fn(async () => fixture);

jest.unstable_mockModule('../models/Kit.js', () => ({
  KitModel: { findById },
}));

const generateQuestionsForRequirement = jest.fn(
  async (
    requirement: { id: string },
    _hiringProcessContext: string,
    category: string,
    options: { startIndex: number },
  ) => [
    {
      id: `q${options.startIndex}`,
      requirement_ids: [requirement.id],
      category,
      prompt: `Fresh question for ${requirement.id}`,
      answer_outline: 'Fresh outline',
      difficulty: 2,
      source: 'generated',
    },
  ],
);

jest.unstable_mockModule('../services/generation/generateQuestions.js', () => ({
  generateQuestionsForRequirement,
  // Not exercised by this test (only buildHiringProcessContext is used from
  // generateKitCore.js's module graph), but coverageLoop.ts imports it by
  // name from this same module, so the mock must still provide the binding.
  categoriesForRequirement: () => [],
}));

const { regenerateQuestionsCategory } = await import('./kitRegenerateController.js');

function makeReq(overrides: { params?: Record<string, string>; body?: unknown } = {}): Request {
  return {
    userId: 'owner-1',
    params: overrides.params ?? { id: '507f1f77bcf86cd799439011', category: 'technical' },
    body: overrides.body ?? {},
  } as unknown as Request;
}

function makeRes() {
  const res: { statusCode?: number; jsonBody?: unknown; status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.jsonBody = body;
    return res;
  });
  return res as unknown as Response & { statusCode?: number; jsonBody?: unknown };
}

const next = jest.fn();

describe('regenerateQuestionsCategory', () => {
  beforeEach(() => {
    fixture = buildFixtureKit();
    findById.mockClear();
    generateQuestionsForRequirement.mockClear();
    next.mockClear();
  });

  it('keeps the locked question, discards and replaces only the unlocked ones, and leaves other categories untouched', async () => {
    const req = makeReq({ params: { id: '507f1f77bcf86cd799439011', category: 'technical' } });
    const res = makeRes();

    await regenerateQuestionsCategory(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);

    // Only one requirement (r2) actually needed regeneration: q1 (locked)
    // already covers r1, so discarding q2/q3 only leaves r2 uncovered.
    expect(generateQuestionsForRequirement).toHaveBeenCalledTimes(1);
    expect(generateQuestionsForRequirement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r2' }),
      expect.any(String),
      'technical',
      expect.objectContaining({ startIndex: expect.any(Number) }),
    );

    const technicalQuestions = fixture.questions.filter((q) => q.category === 'technical');

    // The edited question survives completely unchanged.
    const edited = technicalQuestions.find((q) => q.id === 'q1');
    expect(edited).toEqual({
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'technical',
      prompt: 'Edited prompt',
      answer_outline: 'A1',
      difficulty: 2,
      source: 'edited',
    });

    // The two generated questions are gone.
    expect(technicalQuestions.find((q) => q.id === 'q2')).toBeUndefined();
    expect(technicalQuestions.find((q) => q.id === 'q3')).toBeUndefined();

    // Replaced by a freshly-generated one covering r2, source "generated".
    const fresh = technicalQuestions.filter((q) => q.id !== 'q1');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.requirement_ids).toEqual(['r2']);
    expect(fresh[0]!.source).toBe('generated');
    expect(fresh[0]!.prompt).toBe('Fresh question for r2');

    // The behavioural question in a completely different category is untouched.
    const behavioural = fixture.questions.find((q) => q.id === 'q4');
    expect(behavioural).toEqual({
      id: 'q4',
      requirement_ids: ['r3'],
      category: 'behavioural',
      prompt: 'P4',
      answer_outline: 'A4',
      difficulty: 1,
      source: 'generated',
    });

    expect(fixture.questions).toHaveLength(3);
  });
});
