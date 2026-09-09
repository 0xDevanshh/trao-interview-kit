import { jest } from '@jest/globals';

class MockLLMError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
  }
}

const generateJSON = jest.fn();

jest.unstable_mockModule('../../config/groqClient.js', () => ({
  generateJSON,
  LLMError: MockLLMError,
}));

const { extractRequirements } = await import('./extractRequirements.js');

describe('extractRequirements', () => {
  beforeEach(() => {
    generateJSON.mockReset();
  });

  it('assigns stable sequential ids and preserves the model-decided priority', async () => {
    generateJSON.mockResolvedValueOnce({
      title: 'Senior Backend Engineer',
      seniority: 'Senior',
      responsibilities: ['Build APIs', 'Mentor engineers'],
      requirements: [
        { text: '5+ years of Node.js experience', kind: 'technical', priority: 'must' },
        { text: 'Experience with GraphQL is a plus', kind: 'technical', priority: 'nice' },
        { text: 'Strong communication skills', kind: 'behavioural', priority: 'must' },
      ],
    });

    const result = await extractRequirements('some job description');

    expect(result.title).toBe('Senior Backend Engineer');
    expect(result.requirements.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(result.requirements.map((r) => r.priority)).toEqual(['must', 'nice', 'must']);
    expect(result.requirements.map((r) => r.text)).toEqual([
      '5+ years of Node.js experience',
      'Experience with GraphQL is a plus',
      'Strong communication skills',
    ]);
  });

  it('does not fabricate requirements for a thin job description', async () => {
    generateJSON.mockResolvedValueOnce({
      title: '',
      seniority: '',
      responsibilities: [],
      requirements: [],
    });

    const result = await extractRequirements('Hiring a dev. Apply now.');

    await expect(Promise.resolve(result)).resolves.toBeDefined();
    expect(result.requirements).toEqual([]);
    expect(result.requirements.length).toBe(0);
  });
});
