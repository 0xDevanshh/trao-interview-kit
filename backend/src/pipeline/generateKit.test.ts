import { jest } from '@jest/globals';

// No MongoDB is available in this environment, so the Kit "document" is a
// tiny in-memory stand-in rather than a real Mongoose model — this test's
// real subject is generateKit's own orchestration and the assembled kit
// shape, which is exactly what the final validateKitStructure assertion
// checks. generateJSON and retrieveAll are mocked per the task's ask; the
// persistence layer is mocked out of environmental necessity, not by design.
class FakeKit {
  _id = 'kit-1';
  status = 'draft';
  error: unknown;
  source: unknown;
  company_brief: unknown;
  role: unknown;
  questions: unknown;
  flashcards: unknown;
  schedule: unknown;
  coverage: unknown;
  save = jest.fn(async () => this);
}

let fakeKit: FakeKit;

const findById = jest.fn(async () => fakeKit);

jest.unstable_mockModule('../models/Kit.js', () => ({
  KitModel: { findById },
}));

class MockLLMError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
  }
}

const generateJSON = jest.fn(async (systemPrompt: string) => {
  if (systemPrompt.includes('extract structured role information')) {
    return {
      title: 'Backend Engineer',
      seniority: 'Mid',
      responsibilities: ['Build APIs'],
      requirements: [
        { text: '3+ years Node.js required', kind: 'technical', priority: 'must' },
        { text: 'Mentors junior engineers', kind: 'behavioural', priority: 'nice' },
      ],
    };
  }

  if (systemPrompt.includes('company brief')) {
    return { summary: 'No company information could be found for this company.', what_they_do: '' };
  }

  if (systemPrompt.includes('quick-recall flashcards')) {
    return { flashcards: [{ front: 'Node.js event loop', back: 'Handles async I/O on a single thread.' }] };
  }

  if (systemPrompt.includes('interview questions')) {
    return {
      questions: [
        { prompt: 'Explain the Node.js event loop.', answer_outline: 'Cover phases and async I/O.', difficulty: 2 },
      ],
    };
  }

  throw new Error(`Unexpected system prompt in test mock: ${systemPrompt.slice(0, 80)}`);
});

jest.unstable_mockModule('../config/groqClient.js', () => ({
  generateJSON,
  LLMError: MockLLMError,
}));

const retrieveAll = jest.fn(async () => ({
  pages_used: [],
  company_pages: [],
  discussion_snippets: [],
  retrieval_failures: [{ url_or_source: 'https://acme.example.com', reason: 'COMPANY_UNREACHABLE' }],
}));

jest.unstable_mockModule('../services/retrieval/retrieveAll.js', () => ({
  retrieveAll,
}));

const { generateKit } = await import('./generateKit.js');
const { validateKitStructure } = await import('../schemas/kitValidation.js');

describe('generateKit', () => {
  beforeEach(() => {
    fakeKit = new FakeKit();
    generateJSON.mockClear();
    retrieveAll.mockClear();
    findById.mockClear();
  });

  it('runs the full pipeline end-to-end and saves a kit that passes validateKitStructure', async () => {
    await generateKit(
      'kit-1',
      'We need a backend engineer with 3+ years Node.js experience.',
      'https://acme.example.com',
      5,
    );

    expect(fakeKit.status).toBe('ready');
    expect(fakeKit.error).toBeNull();
    expect(retrieveAll).toHaveBeenCalledTimes(1);

    const assembled = {
      source: fakeKit.source,
      company_brief: fakeKit.company_brief,
      role: fakeKit.role,
      questions: fakeKit.questions,
      flashcards: fakeKit.flashcards,
      schedule: fakeKit.schedule,
      coverage: fakeKit.coverage,
    };

    const validation = validateKitStructure(assembled);

    expect(validation.errors).toBeUndefined();
    expect(validation.valid).toBe(true);
    expect(fakeKit.save).toHaveBeenCalled();
  });
});
