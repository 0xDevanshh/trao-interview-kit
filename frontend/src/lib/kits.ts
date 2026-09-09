import { api } from "@/lib/api";
import type { Kit, KitFlashcard, QuestionCategory } from "@/lib/kitTypes";

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

// ---------------------------------------------------------------------------
// Builder mutations (Phase 8) — every one of these returns the fresh, full
// kit from the server, which callers use to patch local state directly
// rather than refetching.
// ---------------------------------------------------------------------------

export async function updateCompanyBrief(
  kitId: string,
  updates: { summary?: string; what_they_do?: string },
): Promise<Kit> {
  const { data } = await api.patch<{ kit: Kit }>(`/api/kits/${kitId}/company-brief`, updates);
  return data.kit;
}

export async function regenerateCompanyBrief(kitId: string): Promise<Kit> {
  const { data } = await api.post<{ kit: Kit }>(`/api/kits/${kitId}/regenerate/company-brief`);
  return data.kit;
}

export interface QuestionUpdateInput {
  prompt?: string;
  answer_outline?: string;
  difficulty?: 1 | 2 | 3;
  category?: QuestionCategory;
  requirement_ids?: string[];
}

export async function updateQuestion(kitId: string, questionId: string, updates: QuestionUpdateInput): Promise<Kit> {
  const { data } = await api.patch<{ kit: Kit }>(`/api/kits/${kitId}/questions/${questionId}`, updates);
  return data.kit;
}

export async function reorderQuestions(kitId: string, category: QuestionCategory, orderedIds: string[]): Promise<Kit> {
  const { data } = await api.patch<{ kit: Kit }>(`/api/kits/${kitId}/questions/reorder`, { category, orderedIds });
  return data.kit;
}

export async function moveQuestion(kitId: string, questionId: string, newCategory: QuestionCategory): Promise<Kit> {
  const { data } = await api.patch<{ kit: Kit }>(`/api/kits/${kitId}/questions/${questionId}/move`, { newCategory });
  return data.kit;
}

export interface NewQuestionInput {
  category: QuestionCategory;
  requirement_ids: string[];
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
}

export async function addQuestion(kitId: string, input: NewQuestionInput): Promise<Kit> {
  const { data } = await api.post<{ kit: Kit }>(`/api/kits/${kitId}/questions`, input);
  return data.kit;
}

export async function deleteQuestion(kitId: string, questionId: string): Promise<Kit> {
  const { data } = await api.delete<{ kit: Kit }>(`/api/kits/${kitId}/questions/${questionId}`);
  return data.kit;
}

export interface RegenerateCategoryResult {
  kit: Kit;
  newly_uncovered_requirement_ids: string[];
}

export async function regenerateQuestionsCategory(
  kitId: string,
  category: QuestionCategory,
): Promise<RegenerateCategoryResult> {
  const { data } = await api.post<RegenerateCategoryResult>(`/api/kits/${kitId}/regenerate/questions/${category}`);
  return data;
}

export interface FlashcardUpdateInput {
  front?: string;
  back?: string;
  requirement_ids?: string[];
}

export async function updateFlashcard(
  kitId: string,
  flashcardId: string,
  updates: FlashcardUpdateInput,
): Promise<Kit> {
  const { data } = await api.patch<{ kit: Kit }>(`/api/kits/${kitId}/flashcards/${flashcardId}`, updates);
  return data.kit;
}

export async function reorderFlashcards(kitId: string, orderedIds: string[]): Promise<Kit> {
  const { data } = await api.patch<{ kit: Kit }>(`/api/kits/${kitId}/flashcards/reorder`, { orderedIds });
  return data.kit;
}

export interface NewFlashcardInput {
  front: string;
  back: string;
  requirement_ids: string[];
}

export async function addFlashcard(kitId: string, input: NewFlashcardInput): Promise<Kit> {
  const { data } = await api.post<{ kit: Kit }>(`/api/kits/${kitId}/flashcards`, input);
  return data.kit;
}

export async function deleteFlashcard(kitId: string, flashcardId: string): Promise<Kit> {
  const { data } = await api.delete<{ kit: Kit }>(`/api/kits/${kitId}/flashcards/${flashcardId}`);
  return data.kit;
}

export async function regenerateSchedule(kitId: string): Promise<Kit> {
  const { data } = await api.post<{ kit: Kit }>(`/api/kits/${kitId}/regenerate/schedule`);
  return data.kit;
}

// ---------------------------------------------------------------------------
// Practice mode (Phase 10)
// ---------------------------------------------------------------------------

export interface PracticeSessionResponse {
  flashcards: KitFlashcard[];
  coveredCount: number;
  totalCount: number;
}

export async function fetchPracticeSession(kitId: string): Promise<PracticeSessionResponse> {
  const { data } = await api.get<PracticeSessionResponse>(`/api/kits/${kitId}/practice/session`);
  return data;
}

export async function reviewFlashcard(
  kitId: string,
  flashcardId: string,
  confidence: 1 | 2 | 3,
): Promise<KitFlashcard> {
  const { data } = await api.post<{ flashcard: KitFlashcard }>(
    `/api/kits/${kitId}/flashcards/${flashcardId}/review`,
    { confidence },
  );
  return data.flashcard;
}
