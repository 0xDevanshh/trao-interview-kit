import type { NextFunction, Request, Response } from 'express';
import { generateCompanyBrief } from '../services/generation/generateCompanyBrief.js';
import { generateQuestionsForRequirement } from '../services/generation/generateQuestions.js';
import { checkCoverage } from '../services/coverage/checkCoverage.js';
import { allocateSchedule, type ScheduleQuestion, type ScheduleRequirement } from '../services/schedule/allocateSchedule.js';
import { buildHiringProcessContext } from '../pipeline/generateKitCore.js';
import { questionSchema, type KitQuestion } from '../schemas/kitSchema.js';
import { serializeKit } from './kitController.js';
import {
  currentBody,
  isEditable,
  loadOwnedKit,
  nextQuestionIdStart,
  respondNotEditable,
  validateAndSave,
} from './kitEditingUtils.js';

const REGENERATE_QUESTION_COUNT = 2;

function respondRegenerationFailed(res: Response, err: unknown): void {
  res.status(502).json({
    error: {
      code: 'REGENERATION_FAILED',
      message: err instanceof Error ? err.message : 'Regeneration failed unexpectedly',
    },
  });
}

/**
 * Company brief is one atomic section, not a list of individually-lockable
 * items (see kitItemsController.ts's updateCompanyBrief), so this is the
 * one *section*-level regenerate rather than an *item*-level one — it
 * always overwrites company_brief entirely, including any manual edits
 * made via PATCH /:id/company-brief. That's a deliberate exception to
 * "never discard edits", not an oversight.
 */
export async function regenerateCompanyBrief(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const body = currentBody(kit);
    // Falls back to empty inputs if a kit predates the retrieval cache
    // (or retrieval genuinely found nothing) — generateCompanyBrief already
    // handles "no material found" by saying so honestly rather than
    // fabricating content, so no special-casing is needed here.
    const cache = kit._retrievalCache ?? { company_pages: [], discussion_snippets: [] };

    let brief;
    try {
      brief = await generateCompanyBrief(body.source.company, cache.company_pages, cache.discussion_snippets);
    } catch (err) {
      respondRegenerationFailed(res, err);
      return;
    }

    body.company_brief = { summary: brief.summary, what_they_do: brief.what_they_do, sources: brief.sources };

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Regenerates one question category, preserving locked (edited/manual)
 * questions untouched and only replacing the coverage that the discarded
 * "generated" questions used to provide. Recomputes coverage across the
 * FULL question set afterward (a locked question could, after being
 * edited, no longer reference the requirement ids it once did) but does
 * NOT run a full coverage loop across other categories — that's a bigger
 * operation than "regenerate one category" implies. Any newly-uncovered
 * requirement is surfaced in the response for the user to act on.
 */
export async function regenerateQuestionsCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const categoryResult = questionSchema.shape.category.safeParse(req.params.category);
    if (!categoryResult.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Invalid category "${req.params.category}"` } });
      return;
    }
    const category = categoryResult.data;

    const body = currentBody(kit);
    const preUncovered = new Set(body.coverage.uncovered_requirement_ids);

    const otherCategoryQuestions = body.questions.filter((q) => q.category !== category);
    const categoryQuestions = body.questions.filter((q) => q.category === category);
    const locked = categoryQuestions.filter((q) => q.source !== 'generated');
    const unlocked = categoryQuestions.filter((q) => q.source === 'generated');

    const stillCoveredInCategory = new Set(locked.flatMap((q) => q.requirement_ids));
    const previouslyCoveredByUnlocked = new Set(unlocked.flatMap((q) => q.requirement_ids));
    const requirementIdsNeedingRegen = [...previouslyCoveredByUnlocked].filter(
      (id) => !stillCoveredInCategory.has(id),
    );

    const requirementsById = new Map(body.role.requirements.map((r) => [r.id, r]));
    const requirementsNeedingRegen = requirementIdsNeedingRegen
      .map((id) => requirementsById.get(id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    const hiringProcessContext = buildHiringProcessContext(kit._retrievalCache?.discussion_snippets ?? []);

    let nextId = nextQuestionIdStart(body.questions.map((q) => q.id));
    const freshQuestions: KitQuestion[] = [];

    try {
      for (const requirement of requirementsNeedingRegen) {
        const generated = await generateQuestionsForRequirement(requirement, hiringProcessContext, category, {
          startIndex: nextId,
          count: REGENERATE_QUESTION_COUNT,
        });
        freshQuestions.push(...generated);
        nextId += generated.length;
      }
    } catch (err) {
      respondRegenerationFailed(res, err);
      return;
    }

    body.questions = [...otherCategoryQuestions, ...locked, ...freshQuestions];

    const coverageResult = checkCoverage(
      body.role.requirements.map((r) => ({ id: r.id, priority: r.priority })),
      body.questions.map((q) => ({ requirement_ids: q.requirement_ids })),
    );
    body.coverage = { ...body.coverage, uncovered_requirement_ids: coverageResult.uncovered_requirement_ids };

    const newlyUncoveredRequirementIds = coverageResult.uncovered_requirement_ids.filter((id) => !preUncovered.has(id));

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit), newly_uncovered_requirement_ids: newlyUncoveredRequirementIds });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Pure and cheap — no LLM call, no locking concept needed, since the
 * schedule is fully derived from the current question set rather than
 * independently editable content. Always safe to re-run after any
 * question edit/add/delete/regenerate.
 */
export async function regenerateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await loadOwnedKit(req, res);
    if (!kit) return;
    if (!isEditable(kit)) return respondNotEditable(res);

    const body = currentBody(kit);

    const scheduleRequirements: ScheduleRequirement[] = body.role.requirements.map((r) => ({
      id: r.id,
      priority: r.priority,
    }));
    const scheduleQuestions: ScheduleQuestion[] = body.questions.map((q) => ({
      id: q.id,
      requirement_ids: q.requirement_ids,
      difficulty: q.difficulty,
    }));

    body.schedule = allocateSchedule(scheduleRequirements, scheduleQuestions, body.schedule.days_available);

    if (await validateAndSave(kit, res, body)) {
      res.status(200).json({ kit: serializeKit(kit) });
    }
  } catch (err) {
    next(err);
  }
}
