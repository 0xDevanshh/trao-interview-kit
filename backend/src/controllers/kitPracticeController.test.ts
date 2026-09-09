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
      requirements: [{ id: 'r1', text: 'Node.js', kind: 'technical', priority: 'must' }],
    },
    questions: [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2, source: 'generated' },
    ],
    flashcards: [
      // Never reviewed — must sort first regardless of the confidence values below.
      {
        id: 'fc1',
        front: 'F1',
        back: 'B1',
        requirement_ids: ['r1'],
        source: 'generated',
        practice: { timesReviewed: 0, lastConfidence: null, lastReviewedAt: null },
      },
      // Reviewed once, high confidence, reviewed recently.
      {
        id: 'fc2',
        front: 'F2',
        back: 'B2',
        requirement_ids: ['r1'],
        source: 'generated',
        practice: { timesReviewed: 1, lastConfidence: 3, lastReviewedAt: '2026-01-05T00:00:00.000Z' },
      },
      // Reviewed twice, low confidence, reviewed longer ago.
      {
        id: 'fc3',
        front: 'F3',
        back: 'B3',
        requirement_ids: ['r1'],
        source: 'generated',
        practice: { timesReviewed: 2, lastConfidence: 1, lastReviewedAt: '2026-01-01T00:00:00.000Z' },
      },
    ],
    schedule: { days_available: 1, days: [{ day: 1, focus: 'Core', question_ids: ['q1'], minutes: 15 }] },
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

const { reviewFlashcard, getPracticeSession } = await import('./kitPracticeController.js');

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

describe('getPracticeSession', () => {
  beforeEach(() => {
    fixture = buildFixtureKit();
    findById.mockClear();
    next.mockClear();
  });

  it('orders never-reviewed cards before reviewed ones regardless of confidence', async () => {
    const req = makeReq();
    const res = makeRes();

    await getPracticeSession(req, res, next);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as { flashcards: { id: string }[]; coveredCount: number; totalCount: number };
    expect(body.flashcards[0]!.id).toBe('fc1'); // never reviewed, first
  });

  it('sorts reviewed cards by ascending confidence — least confident first', async () => {
    const req = makeReq();
    const res = makeRes();

    await getPracticeSession(req, res, next);

    const body = res.jsonBody as { flashcards: { id: string }[] };
    // fc1 (never reviewed) first, then fc3 (confidence 1) before fc2 (confidence 3).
    expect(body.flashcards.map((f) => f.id)).toEqual(['fc1', 'fc3', 'fc2']);
  });

  it('reports coveredCount vs totalCount', async () => {
    const req = makeReq();
    const res = makeRes();

    await getPracticeSession(req, res, next);

    const body = res.jsonBody as { coveredCount: number; totalCount: number };
    expect(body.totalCount).toBe(3);
    expect(body.coveredCount).toBe(2); // fc2 and fc3 have timesReviewed > 0
  });
});

describe('reviewFlashcard', () => {
  beforeEach(() => {
    fixture = buildFixtureKit();
    findById.mockClear();
    next.mockClear();
  });

  it('increments timesReviewed on a second review rather than resetting it', async () => {
    const req = makeReq({
      params: { id: '507f1f77bcf86cd799439011', flashcardId: 'fc2' },
      body: { confidence: 2 },
    });
    const res = makeRes();

    await reviewFlashcard(req, res, next);

    expect(res.statusCode).toBe(200);
    const updated = fixture.flashcards.find((f) => f.id === 'fc2')!;
    expect(updated.practice.timesReviewed).toBe(2); // was 1, incremented to 2 — not reset
    expect(updated.practice.lastConfidence).toBe(2);
    expect(updated.practice.lastReviewedAt).not.toBe('2026-01-05T00:00:00.000Z');
  });

  it('sets timesReviewed to 1 on a first review of a never-reviewed card', async () => {
    const req = makeReq({
      params: { id: '507f1f77bcf86cd799439011', flashcardId: 'fc1' },
      body: { confidence: 3 },
    });
    const res = makeRes();

    await reviewFlashcard(req, res, next);

    expect(res.statusCode).toBe(200);
    const updated = fixture.flashcards.find((f) => f.id === 'fc1')!;
    expect(updated.practice.timesReviewed).toBe(1);
    expect(updated.practice.lastConfidence).toBe(3);
  });
});
