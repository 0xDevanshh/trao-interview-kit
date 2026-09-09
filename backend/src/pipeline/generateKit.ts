import { KitModel } from '../models/Kit.js';
import { generateKitCore, KitGenerationError, type RetrievalCache } from './generateKitCore.js';
import type { Kit as KitAppendixA } from '../schemas/kitSchema.js';

interface KitFailure {
  message: string;
  details?: string[];
}

async function updateKitStatus(kitId: string, status: 'generating' | 'failed', error?: KitFailure): Promise<void> {
  try {
    const kit = await KitModel.findById(kitId);
    if (!kit) {
      console.error(`generateKit: kit ${kitId} not found while setting status=${status}`);
      return;
    }
    kit.status = status;
    kit.error = error ?? null;
    await kit.save();
  } catch (err) {
    // If we can't even record the failure, there's nothing more this
    // function can do — but it must not throw here, or the original error
    // (already being handled) would be masked.
    console.error(`generateKit: failed to update kit ${kitId} status to ${status}`, err);
  }
}

async function saveReadyKit(kitId: string, assembled: KitAppendixA, retrievalCache: RetrievalCache): Promise<void> {
  const kit = await KitModel.findById(kitId);
  if (!kit) {
    throw new Error(`Kit ${kitId} not found`);
  }

  kit.status = 'ready';
  kit.error = null;

  // Mongoose's TS-inferred types for array-of-subdocument paths (DocumentArray)
  // don't structurally accept a plain array literal, even though this is
  // exactly what Mongoose casts at runtime. Same workaround already used in
  // kitController.ts's patchKit for the same reason.
  const kitBody = kit as unknown as Record<string, unknown>;
  kitBody.source = assembled.source;
  kitBody.company_brief = assembled.company_brief;
  kitBody.role = assembled.role;
  kitBody.questions = assembled.questions;
  kitBody.flashcards = assembled.flashcards;
  kitBody.schedule = assembled.schedule;
  kitBody.coverage = assembled.coverage;
  kitBody._retrievalCache = retrievalCache;

  await kit.save();
}

/**
 * Route-facing wrapper: persists progress/results to the Kit document. All
 * the actual generation logic lives in generateKitCore, shared verbatim
 * with the batch script (scripts/evaluate.ts) — this file only adds the
 * "read/write Mongo by kitId" concern around it.
 */
export async function generateKit(
  kitId: string,
  jd: string,
  companyUrl: string,
  daysAvailable: number,
): Promise<void> {
  try {
    await updateKitStatus(kitId, 'generating');

    const { kit: assembled, retrievalCache } = await generateKitCore(jd, companyUrl, daysAvailable);

    await saveReadyKit(kitId, assembled, retrievalCache);
  } catch (err) {
    if (err instanceof KitGenerationError) {
      await updateKitStatus(kitId, 'failed', {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
      return;
    }

    await updateKitStatus(kitId, 'failed', {
      message: err instanceof Error ? err.message : 'Kit generation failed unexpectedly',
    });
  }
}
