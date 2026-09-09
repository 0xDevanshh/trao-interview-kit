import { api } from "@/lib/api";
import type { Kit } from "@/lib/kitTypes";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchKit(id: string): Promise<Kit> {
  const { data } = await api.get<{ kit: Kit }>(`/api/kits/${id}`);
  return data.kit;
}

export async function createKit(input: {
  jd: string;
  company_url: string;
  days: number;
}): Promise<Kit> {
  const { data } = await api.post<{ kit: Kit }>("/api/kits", input);
  return data.kit;
}

export async function triggerGenerate(id: string): Promise<Kit> {
  const { data } = await api.post<{ kit: Kit }>(`/api/kits/${id}/generate`);
  return data.kit;
}

/**
 * Polls a kit until it reaches "ready" or "failed". Used by the bulk
 * ("multiple roles") flow, which — like the backend batch script — runs
 * one kit's generation to completion before starting the next, rather than
 * firing many generations at once against Groq's rate limits.
 */
export async function waitForKitCompletion(
  id: string,
  options: { intervalMs?: number; onUpdate?: (kit: Kit) => void } = {},
): Promise<Kit> {
  const intervalMs = options.intervalMs ?? 2000;

  while (true) {
    const kit = await fetchKit(id);
    options.onUpdate?.(kit);

    if (kit.status === "ready" || kit.status === "failed") {
      return kit;
    }

    await sleep(intervalMs);
  }
}
