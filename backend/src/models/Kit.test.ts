import { Types } from 'mongoose';
import { KitModel } from './Kit.js';

// No DB connection needed here — Mongoose applies schema defaults when a
// document instance is constructed/hydrated, before any save() happens.

describe('Kit model "source" provenance default', () => {
  it('defaults a question with no source field to "generated"', () => {
    const kit = new KitModel({
      ownerId: new Types.ObjectId(),
      status: 'ready',
      questions: [
        {
          id: 'q1',
          requirement_ids: ['r1'],
          category: 'technical',
          prompt: 'Explain the event loop.',
          answer_outline: 'Cover phases and async I/O.',
          difficulty: 2,
        },
      ],
    });

    expect(kit.questions?.[0]?.source).toBe('generated');
  });

  it('round-trips a flashcard explicitly saved with source: "edited"', () => {
    const kit = new KitModel({
      ownerId: new Types.ObjectId(),
      status: 'ready',
      flashcards: [
        {
          id: 'fc1',
          front: 'Event loop',
          back: 'Handles async I/O on a single thread.',
          requirement_ids: ['r1'],
          source: 'edited',
        },
      ],
    });

    expect(kit.flashcards?.[0]?.source).toBe('edited');
  });
});
