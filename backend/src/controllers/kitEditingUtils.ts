import type { Request, Response } from 'express';
import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { KitModel, type KitDocument } from '../models/Kit.js';
import { validateKitStructure } from '../schemas/kitValidation.js';
import type { Kit as KitAppendixA } from '../schemas/kitSchema.js';

// Shared helpers for every kit-content mutation endpoint (per-item builder
// mutations in kitItemsController.ts, section regeneration in
// kitRegenerateController.ts) — one place for ownership checks, the
// validate-then-save pattern, and id assignment.

export type KitDoc = HydratedDocument<KitDocument>;

export async function loadOwnedKit(req: Request, res: Response): Promise<KitDoc | null> {
  const ownerId = req.userId;
  if (!ownerId) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No token provided' } });
    return null;
  }

  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
    return null;
  }

  const kit = await KitModel.findById(id);
  if (!kit || kit.ownerId.toString() !== ownerId) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
    return null;
  }

  return kit;
}

/** True once the kit actually has generated content to mutate. */
export function isEditable(kit: KitDoc): boolean {
  return kit.questions !== undefined && kit.flashcards !== undefined;
}

export function respondNotEditable(res: Response): void {
  res.status(409).json({
    error: { code: 'NOT_EDITABLE', message: 'This kit has no generated content to edit yet' },
  });
}

/** Plain, JSON-safe snapshot of a kit's Appendix A body, for building a
 * mutated candidate to validate before saving. */
export function currentBody(kit: KitDoc): KitAppendixA {
  return JSON.parse(
    JSON.stringify({
      source: kit.source,
      company_brief: kit.company_brief,
      role: kit.role,
      questions: kit.questions,
      flashcards: kit.flashcards,
      schedule: kit.schedule,
      coverage: kit.coverage,
    }),
  );
}

/** Applies a validated body onto the kit document and saves, or responds
 * 422 with the validator's errors instead. Returns whether it saved.
 *
 * Every caller computes `body` entirely from a fresh copy (currentBody)
 * before calling this — nothing is written to `kit` itself until this
 * point, so a failure anywhere upstream (a validation error, a thrown LLM
 * error) never leaves the previously-saved kit partially mutated. */
export async function validateAndSave(kit: KitDoc, res: Response, body: KitAppendixA): Promise<boolean> {
  const result = validateKitStructure(body);
  if (!result.valid) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Kit failed validation', errors: result.errors } });
    return false;
  }

  const kitBody = kit as unknown as Record<string, unknown>;
  kitBody.source = body.source;
  kitBody.company_brief = body.company_brief;
  kitBody.role = body.role;
  kitBody.questions = body.questions;
  kitBody.flashcards = body.flashcards;
  kitBody.schedule = body.schedule;
  kitBody.coverage = body.coverage;

  await kit.save();
  return true;
}

/**
 * Merges only the defined keys of `updates` onto `base`. A plain `{...base,
 * ...updates}` spread would type (and, if updates came straight from a
 * zod `.partial()` parse, potentially behave) as if every partial field
 * were being overwritten with `undefined` when omitted — this keeps
 * omitted fields untouched instead.
 */
type LooseUpdates<T> = { [K in keyof T]?: T[K] | undefined };

export function mergeDefined<T extends object>(base: T, updates: LooseUpdates<T>): T {
  const result = { ...base };
  for (const key of Object.keys(updates) as (keyof T)[]) {
    const value = updates[key];
    if (value !== undefined) {
      result[key] = value as T[keyof T];
    }
  }
  return result;
}

export function nextAvailableId(existingIds: Set<string>, prefix: string): string {
  let n = 1;
  while (existingIds.has(`${prefix}${n}`)) {
    n += 1;
  }
  return `${prefix}${n}`;
}

/** The next unused numeric qN id, scanning every existing question id
 * (across all categories) rather than just the ones being touched — ids
 * are unique across the whole kit, not per-category. */
export function nextQuestionIdStart(existingIds: Iterable<string>): number {
  let max = 0;
  for (const id of existingIds) {
    const match = /^q(\d+)$/.exec(id);
    if (match?.[1]) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}
