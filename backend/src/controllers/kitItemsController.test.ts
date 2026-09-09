import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

function buildFixtureKit() {
  return {
    _id: '507f1f77bcf86cd799439011',
    ownerId: 'owner-1',
    status: 'ready',
    error: null,
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
        { id: 'r2', text: 'Communication', kind: 'behavioural', priority: 'nice' },
      ],
    },
    questions: [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2, source: 'generated' },
      { id: 'q2', requirement_ids: ['r1'], category: 'technical', prompt: 'P2', answer_outline: 'A2', difficulty: 1, source: 'generated' },
      { id: 'q3', requirement_ids: ['r2'], category: 'behavioural', prompt: 'P3', answer_outline: 'A3', difficulty: 3, source: 'generated' },
    ],
    flashcards: [{ id: 'fc1', front: 'F1', back: 'B1', requirement_ids: ['r1'], source: 'generated' }],
    schedule: { days_available: 1, days: [{ day: 1, focus: 'Core', question_ids: ['q1', 'q2', 'q3'], minutes: 60 }] },
    coverage: { uncovered_requirement_ids: [], passes: 0 },
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

const { updateQuestion, reorderQuestions, moveQuestion, addQuestion } = await import('./kitItemsController.js');

function makeReq(overrides: { params?: Record<string, string>; body?: unknown } = {}): Request {
  return {
    userId: 'owner-1',
    params: overrides.params ?? { id: '507f1f77bcf86cd799439011' },
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

describe('kitItemsController — source provenance rules', () => {
  beforeEach(() => {
    fixture = buildFixtureKit();
    findById.mockClear();
    next.mockClear();
  });

  it('forces source="edited" on content edit, even if the client sends source="generated"', async () => {
    const req = makeReq({
      params: { id: '507f1f77bcf86cd799439011', questionId: 'q1' },
      body: { prompt: 'Updated prompt', source: 'generated' },
    });
    const res = makeRes();

    await updateQuestion(req, res, next);

    expect(res.statusCode).toBe(200);
    const updated = fixture.questions.find((q) => q.id === 'q1')!;
    expect(updated.prompt).toBe('Updated prompt');
    expect(updated.source).toBe('edited');
  });

  it('does not change source when reordering within a category', async () => {
    const req = makeReq({
      params: { id: '507f1f77bcf86cd799439011' },
      body: { category: 'technical', orderedIds: ['q2', 'q1'] },
    });
    const res = makeRes();

    await reorderQuestions(req, res, next);

    expect(res.statusCode).toBe(200);
    const technicalIds = fixture.questions.filter((q) => q.category === 'technical').map((q) => q.id);
    expect(technicalIds).toEqual(['q2', 'q1']);
    expect(fixture.questions.find((q) => q.id === 'q1')!.source).toBe('generated');
    expect(fixture.questions.find((q) => q.id === 'q2')!.source).toBe('generated');
  });

  it('forces source="edited" when moving a question to a different category', async () => {
    const req = makeReq({
      params: { id: '507f1f77bcf86cd799439011', questionId: 'q1' },
      body: { newCategory: 'system-design' },
    });
    const res = makeRes();

    await moveQuestion(req, res, next);

    expect(res.statusCode).toBe(200);
    const moved = fixture.questions.find((q) => q.id === 'q1')!;
    expect(moved.category).toBe('system-design');
    expect(moved.source).toBe('edited');
  });

  it('assigns a non-colliding id and source="manual" when adding a question', async () => {
    const req = makeReq({
      params: { id: '507f1f77bcf86cd799439011' },
      body: {
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'New question',
        answer_outline: 'Outline',
        difficulty: 1,
      },
    });
    const res = makeRes();

    await addQuestion(req, res, next);

    expect(res.statusCode).toBe(201);
    expect(fixture.questions).toHaveLength(4);
    const added = fixture.questions.find((q) => q.prompt === 'New question')!;
    expect(added.id).toBe('q4');
    expect(added.source).toBe('manual');
    // No collision with any pre-existing id.
    expect(new Set(fixture.questions.map((q) => q.id)).size).toBe(fixture.questions.length);
  });
});
