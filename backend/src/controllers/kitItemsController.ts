import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { questionSchema, flashcardSchema } from '../schemas/kitSchema.js';
import { serializeKit } from './kitController.js';
import {
  currentBody,
  isEditable,
  loadOwnedKit,
  mergeDefined,
  nextAvailableId,
  respondNotEditable,
  validateAndSave,
} from './kitEditingUtils.js';

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const questionUpdateSchema = questionSchema
  .pick({ prompt: true, answer_outline: true, difficulty: true, category: true, requirement_ids: true })
  .partial();

export async function updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = questionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
      return;
    }

    const { questionId } = req.params;
    const body = currentBody(kit);
    const index = body.questions.findIndex((q) => q.id === questionId);
    if (index === -1) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Question not found' } });
      return;
    }

    // The one invariant the whole regeneration system depends on: an edit
    // always forces source = "edited" server-side. The client's input is
    // never trusted to flag its own edit — questionUpdateSchema doesn't even
    // include a "source" field, so nothing the client sends can influence it.
    body.questions[index] = { ...mergeDefined(body.questions[index]!, parsed.data), source: 'edited' };

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

const reorderQuestionsSchema = z.object({
  category: questionSchema.shape.category,
  orderedIds: z.array(z.string()).min(1),
});

export async function reorderQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = reorderQuestionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    const { category, orderedIds } = parsed.data;

    const body = currentBody(kit);
    const categoryIds = body.questions.filter((q) => q.category === category).map((q) => q.id);

    const isExactPermutation =
      orderedIds.length === categoryIds.length &&
      new Set(orderedIds).size === orderedIds.length &&
      categoryIds.every((id) => orderedIds.includes(id));

    if (!isExactPermutation) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'orderedIds must be exactly the question ids currently in this category, each once',
        },
      });
      return;
    }

    const byId = new Map(body.questions.map((q) => [q.id, q]));
    let cursor = 0;
    // Reordering only rearranges this category's members; every other
    // question keeps its existing absolute position in the array.
    body.questions = body.questions.map((q) => {
      if (q.category !== category) return q;
      const nextId = orderedIds[cursor]!;
      cursor += 1;
      return byId.get(nextId)!;
    });

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

const moveQuestionSchema = z.object({
  newCategory: questionSchema.shape.category,
});

export async function moveQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = moveQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const { questionId } = req.params;
    const body = currentBody(kit);
    const index = body.questions.findIndex((q) => q.id === questionId);
    if (index === -1) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Question not found' } });
      return;
    }

    // Changing category is a substantive edit, not cosmetic reordering.
    body.questions[index] = { ...body.questions[index]!, category: parsed.data.newCategory, source: 'edited' };

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

const addQuestionSchema = questionSchema.omit({ id: true, source: true });

export async function addQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = addQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const body = currentBody(kit);
    const existingIds = new Set(body.questions.map((q) => q.id));
    const id = nextAvailableId(existingIds, 'q');

    body.questions = [...body.questions, { ...parsed.data, id, source: 'manual' }];

    if (await validateAndSave(kit, res, body)) {
      res.status(201).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const { questionId } = req.params;
    const body = currentBody(kit);
    const exists = body.questions.some((q) => q.id === questionId);
    if (!exists) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Question not found' } });
      return;
    }

    body.questions = body.questions.filter((q) => q.id !== questionId);
    // Cascade cleanup: a schedule day referencing this question's id would
    // otherwise fail validateKitStructure's referential-integrity check.
    // minutes is intentionally left as-is here — recomputing it accurately
    // needs the difficulty->minutes mapping owned by allocateSchedule, and a
    // full reschedule is a builder action of its own, not part of a delete.
    body.schedule.days = body.schedule.days.map((day) => ({
      ...day,
      question_ids: day.question_ids.filter((qid) => qid !== questionId),
    }));

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Flashcards
//
// Flashcards have no "category" field in Appendix A (unlike questions), so
// there is no flashcard equivalent of "move to a different category" —
// that endpoint is intentionally not implemented here rather than inventing
// a category concept the schema doesn't have. Reordering instead applies to
// the whole flashcards array.
// ---------------------------------------------------------------------------

const flashcardUpdateSchema = flashcardSchema.pick({ front: true, back: true, requirement_ids: true }).partial();

export async function updateFlashcard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = flashcardUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
      return;
    }

    const { flashcardId } = req.params;
    const body = currentBody(kit);
    const index = body.flashcards.findIndex((f) => f.id === flashcardId);
    if (index === -1) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Flashcard not found' } });
      return;
    }

    // Same invariant as questions: an edit always forces source = "edited"
    // server-side, never trusting the client's own flag.
    body.flashcards[index] = { ...mergeDefined(body.flashcards[index]!, parsed.data), source: 'edited' };

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

const reorderFlashcardsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export async function reorderFlashcards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = reorderFlashcardsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    const { orderedIds } = parsed.data;

    const body = currentBody(kit);
    const existingIds = body.flashcards.map((f) => f.id);

    const isExactPermutation =
      orderedIds.length === existingIds.length &&
      new Set(orderedIds).size === orderedIds.length &&
      existingIds.every((id) => orderedIds.includes(id));

    if (!isExactPermutation) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'orderedIds must be exactly the current flashcard ids, each once' },
      });
      return;
    }

    const byId = new Map(body.flashcards.map((f) => [f.id, f]));
    body.flashcards = orderedIds.map((id) => byId.get(id)!);

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

const addFlashcardSchema = flashcardSchema.omit({ id: true, source: true, practice: true });

export async function addFlashcard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = addFlashcardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const body = currentBody(kit);
    const existingIds = new Set(body.flashcards.map((f) => f.id));
    const id = nextAvailableId(existingIds, 'fc');

    // practice is never trusted from the client, same as source/id — a new
    // flashcard always starts with no review history.
    body.flashcards = [
      ...body.flashcards,
      { ...parsed.data, id, source: 'manual', practice: { timesReviewed: 0, lastConfidence: null, lastReviewedAt: null } },
    ];

    if (await validateAndSave(kit, res, body)) {
      res.status(201).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

export async function deleteFlashcard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const { flashcardId } = req.params;
    const body = currentBody(kit);
    const exists = body.flashcards.some((f) => f.id === flashcardId);
    if (!exists) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Flashcard not found' } });
      return;
    }

    // No cascade needed: nothing else in Appendix A references a flashcard id.
    body.flashcards = body.flashcards.filter((f) => f.id !== flashcardId);

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Company brief
// ---------------------------------------------------------------------------

const companyBriefUpdateSchema = z
  .object({
    summary: z.string().min(1),
    what_they_do: z.string().min(1),
  })
  .partial();

/**
 * No source tracking here, unlike questions/flashcards: company_brief is a
 * single atomic object, not an array of individually-regenerable items —
 * there's no per-item provenance to track. Note for 8.3: a full
 * company_brief regenerate will still overwrite whatever was edited here by
 * design, since the whole section is one unit rather than something that
 * can be partially "locked" the way an edited question or flashcard can.
 */
export async function updateCompanyBrief(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const parsed = companyBriefUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
      return;
    }

    const body = currentBody(kit);
    body.company_brief = mergeDefined(body.company_brief, parsed.data);

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}
