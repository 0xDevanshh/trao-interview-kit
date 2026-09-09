import Groq, { APIError } from 'groq-sdk';

export type LLMErrorCode = 'RATE_LIMITED' | 'INVALID_JSON' | 'PROVIDER_ERROR';

export class LLMError extends Error {
  code: LLMErrorCode;
  cause?: unknown;

  constructor(code: LLMErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.cause = cause;
  }
}

// Groq's hosted model lineup changes over time; llama-3.3-70b-versatile has
// since been retired (confirmed via a live clean-environment run against
// the models list endpoint, which no longer lists it at all). This is
// current as of this writing but not guaranteed to stay so — if this model
// disappears too, check `client.models.list()` for what's currently active.
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const BASE_DELAY_MS = 1000;
const MAX_RETRIES = 3;

let client: Groq | undefined;

function getClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new LLMError('PROVIDER_ERROR', 'GROQ_API_KEY is not set');
    }
    client = new Groq({ apiKey });
  }
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): err is APIError {
  return err instanceof APIError && (err.status === 429 || (typeof err.status === 'number' && err.status >= 500));
}

function retryDelayMs(err: APIError, attempt: number): number {
  const retryAfter = err.headers?.get?.('retry-after');
  if (retryAfter) {
    const parsed = Number(retryAfter);
    if (!Number.isNaN(parsed)) {
      return parsed * 1000;
    }
  }
  return BASE_DELAY_MS * 2 ** attempt;
}

export async function generateJSON(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL,
): Promise<unknown> {
  const groq = getClient();

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= MAX_RETRIES) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new LLMError('INVALID_JSON', 'Groq response contained no content');
      }

      try {
        return JSON.parse(content);
      } catch (parseErr) {
        throw new LLMError('INVALID_JSON', 'Groq response was not valid JSON', parseErr);
      }
    } catch (err) {
      if (err instanceof LLMError) {
        throw err;
      }

      lastError = err;

      if (isRetryable(err) && attempt < MAX_RETRIES) {
        await sleep(retryDelayMs(err, attempt));
        attempt += 1;
        continue;
      }

      if (err instanceof APIError && err.status === 429) {
        throw new LLMError('RATE_LIMITED', 'Groq rate limit exceeded after retries', err);
      }

      throw new LLMError('PROVIDER_ERROR', 'Groq request failed', err);
    }
  }

  throw new LLMError('PROVIDER_ERROR', 'Groq request failed after retries exhausted', lastError);
}
