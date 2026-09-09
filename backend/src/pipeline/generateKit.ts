import pLimit from 'p-limit';
import { KitModel } from '../models/Kit.js';
import { LLMError } from '../config/groqClient.js';
import { validateKitStructure } from '../schemas/kitValidation.js';
import type { Kit as KitAppendixA } from '../schemas/kitSchema.js';
import { extractRequirements, type ExtractedRequirement } from '../services/extraction/extractRequirements.js';
import { retrieveAll } from '../services/retrieval/retrieveAll.js';
import { generateCompanyBrief } from '../services/generation/generateCompanyBrief.js';
import {
  categoriesForRequirement,
  generateQuestionsForRequirement,
  type GeneratedQuestion,
  type QuestionCategory,
} from '../services/generation/generateQuestions.js';
import { generateFlashcardsForRequirement, type GeneratedFlashcard } from '../services/generation/generateFlashcards.js';
import { runCoverageLoop } from '../services/coverage/coverageLoop.js';
import { allocateSchedule, type ScheduleQuestion, type ScheduleRequirement } from '../services/schedule/allocateSchedule.js';

const QUESTION_CONCURRENCY = 3;
const QUESTIONS_PER_PAIR = 3;
const FLASHCARDS_PER_REQUIREMENT = 2;

// Generous, deliberately not tied to generateQuestions'/generateFlashcards'
// internal max-per-call constants: each fan-out task reserves a block of id
// numbers up front (before knowing how many the model will actually return)
// so concurrent calls can never collide on an id, even if some calls return
// fewer items than requested.
const QUESTION_ID_BLOCK = 20;
const FLASHCARD_ID_BLOCK = 10;

const HIRING_PROCESS_CONTEXT_BUDGET = 2000;

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

async function saveReadyKit(kitId: string, assembled: KitAppendixA): Promise<void> {
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

  await kit.save();
}

/**
 * Nothing in this pipeline extracts a company name (extractRequirements only
 * looks at role/requirements; retrieval takes a name as input rather than
 * producing one). The only signal available is the company URL itself, so
 * that's what this guesses from — pure string logic, no LLM call.
 */
function guessCompanyName(companyUrl: string): string {
  try {
    const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');
    const base = hostname.split('.')[0] ?? hostname;
    return base.length > 0 ? base.charAt(0).toUpperCase() + base.slice(1) : hostname;
  } catch {
    return companyUrl;
  }
}

function buildHiringProcessContext(discussionSnippets: { text: string }[]): string {
  const combined = discussionSnippets.map((snippet) => snippet.text).join('\n\n');
  return combined.slice(0, HIRING_PROCESS_CONTEXT_BUDGET);
}

interface QuestionTask {
  requirement: ExtractedRequirement;
  category: QuestionCategory;
  startIndex: number;
}

function buildQuestionTasks(requirements: ExtractedRequirement[]): QuestionTask[] {
  const tasks: QuestionTask[] = [];
  let taskIndex = 0;

  for (const requirement of requirements) {
    for (const category of categoriesForRequirement(requirement.kind)) {
      tasks.push({ requirement, category, startIndex: 1 + taskIndex * QUESTION_ID_BLOCK });
      taskIndex += 1;
    }
  }

  return tasks;
}

async function generateAllQuestions(
  requirements: ExtractedRequirement[],
  hiringProcessContext: string,
): Promise<GeneratedQuestion[]> {
  const tasks = buildQuestionTasks(requirements);
  const limit = pLimit(QUESTION_CONCURRENCY);

  const batches = await Promise.all(
    tasks.map((task) =>
      limit(() =>
        generateQuestionsForRequirement(task.requirement, hiringProcessContext, task.category, {
          startIndex: task.startIndex,
          count: QUESTIONS_PER_PAIR,
        }),
      ),
    ),
  );

  return batches.flat();
}

async function generateAllFlashcards(requirements: ExtractedRequirement[]): Promise<GeneratedFlashcard[]> {
  const limit = pLimit(QUESTION_CONCURRENCY);

  const batches = await Promise.all(
    requirements.map((requirement, index) =>
      limit(() =>
        generateFlashcardsForRequirement(requirement, {
          startIndex: 1 + index * FLASHCARD_ID_BLOCK,
          count: FLASHCARDS_PER_REQUIREMENT,
        }),
      ),
    ),
  );

  return batches.flat();
}

export async function generateKit(
  kitId: string,
  jd: string,
  companyUrl: string,
  daysAvailable: number,
): Promise<void> {
  try {
    await updateKitStatus(kitId, 'generating');

    let extracted;
    try {
      extracted = await extractRequirements(jd);
    } catch (err) {
      if (err instanceof LLMError) {
        await updateKitStatus(kitId, 'failed', {
          message: `Requirement extraction failed: ${err.message}`,
          details: [err.code],
        });
        return;
      }
      throw err;
    }

    const companyName = guessCompanyName(companyUrl);

    // A retrieval failure (no discoverable hiring/about page, unreachable
    // site, etc.) is a valid outcome, not a kit failure — retrieveAll never
    // throws and always resolves to a usable, possibly-empty result.
    const retrieval = await retrieveAll(companyUrl, companyName, extracted.title || undefined);

    const brief = await generateCompanyBrief(companyName, retrieval.company_pages, retrieval.discussion_snippets);

    const hiringProcessContext = buildHiringProcessContext(retrieval.discussion_snippets);

    let questions = await generateAllQuestions(extracted.requirements, hiringProcessContext);

    const coverageResult = await runCoverageLoop(
      extracted.requirements,
      questions,
      generateQuestionsForRequirement,
      hiringProcessContext,
    );
    questions = coverageResult.questions;

    const flashcards = await generateAllFlashcards(extracted.requirements);

    const scheduleRequirements: ScheduleRequirement[] = extracted.requirements.map((r) => ({
      id: r.id,
      priority: r.priority,
    }));
    const scheduleQuestions: ScheduleQuestion[] = questions.map((q) => ({
      id: q.id,
      requirement_ids: q.requirement_ids,
      difficulty: q.difficulty,
    }));
    const schedule = allocateSchedule(scheduleRequirements, scheduleQuestions, daysAvailable);

    const assembled: KitAppendixA = {
      source: {
        company: companyName,
        company_url: companyUrl,
        role: extracted.title,
        location: '',
        jd_chars: jd.length,
        researched_at: new Date().toISOString(),
        pages_used: retrieval.pages_used,
      },
      company_brief: {
        summary: brief.summary,
        what_they_do: brief.what_they_do,
        sources: brief.sources,
      },
      role: {
        title: extracted.title,
        seniority: extracted.seniority,
        responsibilities: extracted.responsibilities,
        requirements: extracted.requirements,
      },
      questions,
      flashcards,
      schedule,
      coverage: {
        uncovered_requirement_ids: coverageResult.uncovered_requirement_ids,
        passes: coverageResult.passes,
      },
    };

    const validation = validateKitStructure(assembled);
    if (!validation.valid) {
      await updateKitStatus(kitId, 'failed', {
        message: 'Assembled kit failed structural validation',
        ...(validation.errors ? { details: validation.errors } : {}),
      });
      return;
    }

    await saveReadyKit(kitId, assembled);
  } catch (err) {
    await updateKitStatus(kitId, 'failed', {
      message: err instanceof Error ? err.message : 'Kit generation failed unexpectedly',
    });
  }
}
