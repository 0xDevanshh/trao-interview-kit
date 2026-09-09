import { jest } from '@jest/globals';

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
      requirements: [{ text: '3+ years Node.js required', kind: 'technical', priority: 'must' }],
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

const retrieveAll = jest.fn();

jest.unstable_mockModule('../services/retrieval/retrieveAll.js', () => ({
  retrieveAll,
}));

const { runEvaluation } = await import('./evaluate.js');
const { validateKitStructure } = await import('../schemas/kitValidation.js');

describe('runEvaluation', () => {
  beforeEach(() => {
    generateJSON.mockClear();
    retrieveAll.mockReset();
  });

  it('reports one succeeding case as "ok" and one where retrieval fails entirely as "failed", matching Appendix B', async () => {
    retrieveAll
      // Case 1: retrieval succeeds (even with nothing found — a normal, non-throwing outcome).
      .mockResolvedValueOnce({
        pages_used: [],
        company_pages: [],
        discussion_snippets: [],
        retrieval_failures: [],
      })
      // Case 2: retrieval fails entirely — simulates a hard failure so no kit can be assembled.
      .mockRejectedValueOnce(new Error('COMPANY_UNREACHABLE'));

    const output = await runEvaluation([
      { id: 'case-ok', jd: 'Backend engineer, 3+ years Node.js.', company_url: 'https://acme.example.com', days: 3 },
      { id: 'case-fail', jd: 'Backend engineer, 3+ years Node.js.', company_url: 'https://unreachable.example.com', days: 3 },
    ]);

    expect(output.version).toBe('1.0');
    expect(typeof output.generated_at).toBe('string');
    expect(output.kits).toHaveLength(2);

    const [okResult, failedResult] = output.kits;

    expect(okResult).toMatchObject({ id: 'case-ok', status: 'ok', error: null });
    expect(okResult!.kit).not.toBeNull();
    const validation = validateKitStructure(okResult!.kit);
    expect(validation.errors).toBeUndefined();
    expect(validation.valid).toBe(true);

    expect(failedResult).toMatchObject({ id: 'case-fail', status: 'failed', kit: null });
    expect(typeof failedResult!.error).toBe('string');
    expect(failedResult!.error).toMatch(/COMPANY_UNREACHABLE/);
  });
});
