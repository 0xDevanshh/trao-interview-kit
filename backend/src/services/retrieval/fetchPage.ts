import { fetch } from 'undici';
import { validateUrl } from './urlGuard.js';
import { isAllowed } from './robotsCheck.js';
import { withOriginRateLimit } from './rateLimiter.js';

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

export type FetchPageResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: string };

type AttemptResult =
  | { kind: 'success'; html: string; finalUrl: string }
  | { kind: 'reject'; reason: string }
  | { kind: 'retryable'; reason: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSupportedContentType(contentType: string): boolean {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === 'text/html' || type === 'text/plain';
}

async function attemptFetch(url: string): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status >= 500) {
      response.body?.cancel();
      return { kind: 'retryable', reason: `Upstream returned ${response.status}` };
    }

    if (!response.ok) {
      response.body?.cancel();
      return { kind: 'reject', reason: `Upstream returned ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!isSupportedContentType(contentType)) {
      response.body?.cancel();
      return { kind: 'reject', reason: `Unsupported content type "${contentType}"` };
    }

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    if (reader) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_BYTES) {
            controller.abort();
            return { kind: 'reject', reason: `Response exceeded ${MAX_BYTES} byte limit` };
          }
          chunks.push(value);
        }
      }
    }

    const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf-8');
    return { kind: 'success', html, finalUrl: response.url || url };
  } catch (err) {
    return { kind: 'retryable', reason: err instanceof Error ? err.message : 'Network error' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPage(url: string): Promise<FetchPageResult> {
  const validation = validateUrl(url);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason ?? 'URL rejected' };
  }

  const allowed = await isAllowed(url);
  if (!allowed) {
    return { ok: false, reason: 'Disallowed by robots.txt' };
  }

  let lastReason = 'Request failed';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const result = await withOriginRateLimit(url, () => attemptFetch(url));

    if (result.kind === 'success') {
      return { ok: true, html: result.html, finalUrl: result.finalUrl };
    }

    if (result.kind === 'reject') {
      return { ok: false, reason: result.reason };
    }

    lastReason = result.reason;
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  return { ok: false, reason: lastReason };
}
