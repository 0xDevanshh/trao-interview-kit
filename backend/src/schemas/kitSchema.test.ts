import { flashcardSchema, questionSchema } from './kitSchema.js';

const baseQuestion = {
  id: 'q1',
  requirement_ids: ['r1'],
  category: 'technical' as const,
  prompt: 'Explain the event loop.',
  answer_outline: 'Cover phases and async I/O.',
  difficulty: 2 as const,
};

const baseFlashcard = {
  id: 'fc1',
  front: 'Event loop',
  back: 'Handles async I/O on a single thread.',
  requirement_ids: ['r1'],
};

describe('question/flashcard "source" provenance field', () => {
  it('defaults a question with no source field to "generated"', () => {
    const result = questionSchema.parse(baseQuestion);
    expect(result.source).toBe('generated');
  });

  it('round-trips a question with source: "edited"', () => {
    const result = questionSchema.parse({ ...baseQuestion, source: 'edited' });
    expect(result.source).toBe('edited');
  });

  it('defaults a flashcard with no source field to "generated"', () => {
    const result = flashcardSchema.parse(baseFlashcard);
    expect(result.source).toBe('generated');
  });

  it('round-trips a flashcard with source: "manual"', () => {
    const result = flashcardSchema.parse({ ...baseFlashcard, source: 'manual' });
    expect(result.source).toBe('manual');
  });

  it('rejects an invalid source value when one is present', () => {
    expect(() => questionSchema.parse({ ...baseQuestion, source: 'bogus' })).toThrow();
  });
});
