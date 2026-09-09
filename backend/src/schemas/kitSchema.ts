import { z } from 'zod';

const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO date string',
});

export const requirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice']),
});

export const questionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
});

export const scheduleDaySchema = z.object({
  day: z.number().int(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int(),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int(),
    researched_at: isoDateString,
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: z.object({
    days_available: z.number().int(),
    days: z.array(scheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int(),
  }),
});

export type Kit = z.infer<typeof kitSchema>;
export type KitRequirement = z.infer<typeof requirementSchema>;
export type KitQuestion = z.infer<typeof questionSchema>;
export type KitFlashcard = z.infer<typeof flashcardSchema>;
export type KitScheduleDay = z.infer<typeof scheduleDaySchema>;
