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

const { generateCompanyBrief } = await import('./generateCompanyBrief.js');

describe('generateCompanyBrief', () => {
  beforeEach(() => {
    generateJSON.mockReset();
  });

  it('lists exactly the URLs whose text was provided as sources', async () => {
    generateJSON.mockResolvedValueOnce({
      summary: 'Acme builds developer tools and has a well-regarded interview process.',
      what_they_do: 'Acme makes developer tooling.',
    });

    const companyPages = [{ url: 'https://acme.example.com/about', text: 'Acme builds developer tools.' }];
    const discussionSnippets = [{ url: 'https://reddit.com/r/jobs/acme', text: 'Acme interviews are fair.' }];

    const result = await generateCompanyBrief('Acme', companyPages, discussionSnippets);

    expect(result.sources).toEqual(['https://acme.example.com/about', 'https://reddit.com/r/jobs/acme']);
    expect(generateJSON).toHaveBeenCalledTimes(1);
  });

  it('does not claim specifics when no material was found at all', async () => {
    generateJSON.mockImplementationOnce(async (_system: string, userPrompt: string) => {
      // The honesty requirement is enforced by the model per the prompt; this
      // simulates a well-behaved model response to a genuinely empty input.
      expect(userPrompt).toContain("No pages from the company's own website could be found");
      expect(userPrompt).toContain('No public discussion material');
      return {
        summary: 'No company information could be found for this company.',
        what_they_do: '',
      };
    });

    const result = await generateCompanyBrief('Unknown Co', [], []);

    expect(result.sources).toEqual([]);
    expect(result.summary).toMatch(/no company information/i);
    expect(result.summary).not.toMatch(/industry-leading|innovative|world-class/i);
  });
});
