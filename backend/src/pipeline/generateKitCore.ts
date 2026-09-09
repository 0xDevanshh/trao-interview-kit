import net from 'node:net';
import pLimit from 'p-limit';
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

/**
 * Raised only when NO kit could be produced at all — extraction failed
 * outright, or the assembled object failed structural validation. Callers
 * (the route handler, the batch script) both treat this, and any other
 * thrown error, as "this case/kit failed"; every other outcome from this
 * function (an unreachable company site, thin coverage, an honestly empty
 * company brief) is a valid, non-throwing result.
 */
export class KitGenerationError extends Error {
  code: string;
  details?: string[];

  constructor(message: string, code: string, details?: string[]) {
    super(message);
    this.name = 'KitGenerationError';
    this.code = code;
    if (details) {
      this.details = details;
    }
  }
}

/**
 * Nothing in this pipeline extracts a company name (extractRequirements only
 * looks at role/requirements; retrieval takes a name as input rather than
 * producing one). The only signal available is the company URL itself, so
 * that's what this guesses from — pure string logic, no LLM call.
 *
 * When the host is a bare IP or "localhost" (exactly what the batch harness
 * uses — Section 9 serves company sites from localhost), the first-label
 * heuristic produces nonsense (e.g. "127" for 127.0.0.1). There's no real
 * hostname to guess from in that case, so this falls back to the full URL
 * rather than fabricating a misleading label.
 */
function guessCompanyName(companyUrl: string): string {
  try {
    const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');

    if (net.isIP(hostname) !== 0 || hostname.toLowerCase() === 'localhost') {
      return companyUrl;
    }

    const base = hostname.split('.')[0] ?? hostname;
    return base.length > 0 ? base.charAt(0).toUpperCase() + base.slice(1) : hostname;
  } catch {
    return companyUrl;
  }
}

export function buildHiringProcessContext(discussionSnippets: { text: string }[]): string {
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

export interface RetrievalCache {
  company_pages: { url: string; text: string }[];
  discussion_snippets: { url: string; text: string }[];
}

export interface GeneratedKit {
  kit: KitAppendixA;
  /**
   * The raw retrieval this run used to write the company brief — callers
   * that persist the kit (generateKit.ts) cache this on the Kit document so
   * a later company-brief regenerate doesn't need to re-crawl the company's
   * site and re-run discussion search from scratch.
   */
  retrievalCache: RetrievalCache;
}

/**
 * The DB-free heart of kit generation: takes raw inputs, returns an
 * assembled kit that has already passed validateKitStructure (plus the
 * retrieval used to produce its company brief). Both the route/orchestrator
 * (generateKit.ts, which persists to Mongo) and the batch script
 * (scripts/evaluate.ts) call this exact function — there is no separate,
 * simplified pipeline for batch mode.
 */
export async function generateKitCore(jd: string, companyUrl: string, daysAvailable: number): Promise<GeneratedKit> {
  let extracted;
  try {
    extracted = await extractRequirements(jd);
  } catch (err) {
    if (err instanceof LLMError) {
      throw new KitGenerationError(`Requirement extraction failed: ${err.message}`, err.code);
    }
    throw new KitGenerationError(
      err instanceof Error ? `Requirement extraction failed: ${err.message}` : 'Requirement extraction failed unexpectedly',
      'EXTRACTION_FAILED',
    );
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
    throw new KitGenerationError('Assembled kit failed structural validation', 'INVALID_KIT_STRUCTURE', validation.errors);
  }

  return {
    kit: assembled,
    retrievalCache: {
      company_pages: retrieval.company_pages,
      discussion_snippets: retrieval.discussion_snippets,
    },
  };
}
