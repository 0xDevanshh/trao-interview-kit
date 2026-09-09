import pLimit, { type LimitFunction } from 'p-limit';

const MAX_CONCURRENT_PER_ORIGIN = 2;
const MIN_GAP_MS = 500;

interface OriginState {
  limit: LimitFunction;
  lastRequestAt: number;
}

const originStates = new Map<string, OriginState>();

function getOriginState(origin: string): OriginState {
  let state = originStates.get(origin);
  if (!state) {
    state = { limit: pLimit(MAX_CONCURRENT_PER_ORIGIN), lastRequestAt: 0 };
    originStates.set(origin, state);
  }
  return state;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withOriginRateLimit<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const origin = new URL(url).origin;
  const state = getOriginState(origin);

  return state.limit(async () => {
    const elapsed = Date.now() - state.lastRequestAt;
    if (elapsed < MIN_GAP_MS) {
      await sleep(MIN_GAP_MS - elapsed);
    }
    state.lastRequestAt = Date.now();
    return fn();
  });
}
