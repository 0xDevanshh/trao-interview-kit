import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { generateKitCore, KitGenerationError } from '../pipeline/generateKitCore.js';
import type { Kit as KitAppendixA } from '../schemas/kitSchema.js';

// This script does NOT connect to MongoDB — it calls generateKitCore, the
// same DB-free pipeline function the API route uses, and writes results
// straight to a file. MONGODB_URI is irrelevant to batch mode; only
// GROQ_API_KEY (read via dotenv from .env, documented in .env.example) is
// actually needed.

export interface EvaluateCaseInput {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface EvaluateCaseResult {
  id: string;
  status: 'ok' | 'failed';
  kit: KitAppendixA | null;
  error: string | null;
}

export interface EvaluateOutput {
  version: string;
  generated_at: string;
  kits: EvaluateCaseResult[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Kit generation failed unexpectedly';
}

/**
 * Runs one case through the exact same pipeline the API uses.
 * generateKitCore throws only when NO kit could be produced at all (a
 * KitGenerationError, or any other unexpected error) — every other outcome,
 * including a company site that couldn't be researched at all, comes back
 * as a normal (possibly thin) kit and is reported "ok".
 */
export async function runEvaluationCase(input: EvaluateCaseInput): Promise<EvaluateCaseResult> {
  try {
    const { kit } = await generateKitCore(input.jd, input.company_url, input.days);
    return { id: input.id, status: 'ok', kit, error: null };
  } catch (err) {
    return { id: input.id, status: 'failed', kit: null, error: errorMessage(err) };
  }
}

/**
 * Runs every case sequentially — not for lack of concurrency support, but
 * because the actual constraint (per the brief) is Groq's rate limit across
 * a handful of cases in a fixed time budget, not raw wall-clock speed.
 * One case failing is caught and recorded; it never aborts the run.
 */
export async function runEvaluation(cases: EvaluateCaseInput[]): Promise<EvaluateOutput> {
  const kits: EvaluateCaseResult[] = [];

  for (const testCase of cases) {
    process.stderr.write(`[evaluate] running case "${testCase.id}"...\n`);

    const result = await runEvaluationCase(testCase);

    process.stderr.write(`[evaluate] case "${testCase.id}": ${result.status}\n`);
    kits.push(result);
  }

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits,
  };
}

interface CliArgs {
  input: string;
  output: string;
}

export function parseArgs(argv: string[]): CliArgs {
  let input: string | undefined;
  let output: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') {
      input = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--output') {
      output = argv[i + 1];
      i += 1;
    }
  }

  if (!input || !output) {
    throw new Error('Usage: evaluate --input <path> --output <path>');
  }

  return { input, output };
}

async function main(): Promise<void> {
  const { input, output } = parseArgs(process.argv.slice(2));

  const raw = await readFile(input, 'utf-8');
  const cases = JSON.parse(raw) as EvaluateCaseInput[];

  process.stderr.write(`[evaluate] loaded ${cases.length} case(s) from ${input}\n`);

  const result = await runEvaluation(cases);

  await writeFile(output, JSON.stringify(result, null, 2), 'utf-8');

  process.stderr.write(`[evaluate] wrote ${result.kits.length} result(s) to ${output}\n`);
}

// Only run when this file is executed directly, not when imported (e.g. by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    process.stderr.write(`[evaluate] fatal: ${errorMessage(err)}\n`);
    process.exitCode = 1;
  });
}
