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

// Provenance of an editable item, added on top of Appendix A (the brief
// permits extending the shape as long as required fields stay present and
// exactly named). Anything generated before this field existed has no
// "source" key at all; defaulting it to "generated" is the correct
// backward-compatible assumption — those kits are still fully regenerable,
// nothing old is accidentally treated as user-locked.
export const editableItemSourceSchema = z.enum(['generated', 'edited', 'manual']).default('generated');

export const questionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  source: editableItemSourceSchema,
});

// Practice-mode progress, another extension beyond Appendix A (same
// pattern as "source" above). 1 = low confidence ("didn't know it"), 3 =
// high confidence ("knew it cold") — this scale is used consistently
// everywhere it appears, including the frontend. Defaults describe a
// flashcard that has never been reviewed; any flashcard saved before this
// field existed correctly comes back with these defaults rather than
// fabricated review history.
export const flashcardPracticeSchema = z
  .object({
    timesReviewed: z.number().int().nonnegative().default(0),
    lastConfidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().default(null),
    lastReviewedAt: isoDateString.nullable().default(null),
  })
  .default({ timesReviewed: 0, lastConfidence: null, lastReviewedAt: null });

export const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  source: editableItemSourceSchema,
  practice: flashcardPracticeSchema,
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
export type EditableItemSource = z.infer<typeof editableItemSourceSchema>;
export type FlashcardPractice = z.infer<typeof flashcardPracticeSchema>;
