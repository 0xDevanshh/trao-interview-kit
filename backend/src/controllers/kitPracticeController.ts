import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { currentBody, isEditable, loadOwnedKit, respondNotEditable, validateAndSave } from './kitEditingUtils.js';

const reviewSchema = z.object({
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

/**
 * POST /:id/flashcards/:flashcardId/review
 *
 * 1 = low confidence ("didn't know it"), 3 = high confidence ("knew it
 * cold") — used consistently everywhere this scale appears, including the
 * frontend. Bumps timesReviewed rather than resetting it, since practice
 * history accumulates across sessions.
 */
export async function reviewFlashcard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const { flashcardId } = req.params;
    const body = currentBody(kit);
    const index = body.flashcards.findIndex((f) => f.id === flashcardId);
    if (index === -1) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Flashcard not found' } });
      return;
    }

    const existing = body.flashcards[index]!;
    const updated = {
      ...existing,
      practice: {
        timesReviewed: existing.practice.timesReviewed + 1,
        lastConfidence: parsed.data.confidence,
        lastReviewedAt: new Date().toISOString(),
      },
    };
    body.flashcards[index] = updated;

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ flashcard: updated });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /:id/practice/session
 *
 * Orders flashcards for the next practice session: never-reviewed cards
 * first (in their existing order), then reviewed cards by ascending
 * confidence (least confident first), tie-broken by ascending
 * lastReviewedAt (longest since reviewed first). This is a simple recency
 * tiebreak, not full spaced repetition.
 */
export async function getPracticeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const body = currentBody(kit);
    const flashcards = body.flashcards;

    const neverReviewed = flashcards.filter((f) => f.practice.lastConfidence === null);
    const reviewed = flashcards
      .filter((f) => f.practice.lastConfidence !== null)
      .sort((a, b) => {
        if (a.practice.lastConfidence !== b.practice.lastConfidence) {
          return a.practice.lastConfidence! - b.practice.lastConfidence!;
        }
        const aTime = a.practice.lastReviewedAt ? new Date(a.practice.lastReviewedAt).getTime() : 0;
        const bTime = b.practice.lastReviewedAt ? new Date(b.practice.lastReviewedAt).getTime() : 0;
        return aTime - bTime;
      });

    res.status(200).json({
      flashcards: [...neverReviewed, ...reviewed],
      coveredCount: flashcards.filter((f) => f.practice.timesReviewed > 0).length,
      totalCount: flashcards.length,
    });
  } catch (err) {
    next(err);
  }
}
