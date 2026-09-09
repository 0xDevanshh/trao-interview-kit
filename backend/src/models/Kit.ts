import { Schema, model, type InferSchemaType } from 'mongoose';

const requirementSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: { type: String, required: true, enum: ['technical', 'behavioural', 'domain'] },
    priority: { type: String, required: true, enum: ['must', 'nice'] },
  },
  { _id: false },
);

// Provenance for editable items — an extension on top of Appendix A (the
// brief permits this as long as required fields stay present and exactly
// named). Any kit saved before this field existed has no "source" key at
// all in its stored document; Mongoose applies this same default on read,
// so old kits correctly come back as fully "generated" (i.e. still safe to
// regenerate wholesale) rather than accidentally locked as user-edited.
const EDITABLE_ITEM_SOURCE_VALUES = ['generated', 'edited', 'manual'] as const;
const editableItemSourceField = {
  type: String,
  enum: EDITABLE_ITEM_SOURCE_VALUES,
  default: 'generated',
} as const;

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    requirement_ids: { type: [String], required: true, default: [] },
    category: {
      type: String,
      required: true,
      enum: ['technical', 'behavioural', 'system-design', 'company-fit'],
    },
    prompt: { type: String, required: true },
    answer_outline: { type: String, required: true },
    difficulty: { type: Number, required: true, enum: [1, 2, 3] },
    source: editableItemSourceField,
  },
  { _id: false },
);

// Practice-mode progress — another extension beyond Appendix A (same
// pattern as "source"). lastConfidence is intentionally NOT constrained by
// a Mongoose enum here (unlike e.g. "source"): a nullable enum's
// interaction with Mongoose's enum validator on null is finicky, and
// kitSchema.ts's Zod validation is already the authoritative check that
// runs before every save (see kitEditingUtils.ts's validateAndSave).
const flashcardPracticeSchema = new Schema(
  {
    timesReviewed: { type: Number, required: true, default: 0 },
    lastConfidence: { type: Number, required: false, default: null },
    lastReviewedAt: { type: String, required: false, default: null },
  },
  { _id: false },
);

const flashcardSchema = new Schema(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: { type: [String], required: true, default: [] },
    source: editableItemSourceField,
    practice: { type: flashcardPracticeSchema, required: true, default: () => ({}) },
  },
  { _id: false },
);

const scheduleDaySchema = new Schema(
  {
    day: { type: Number, required: true },
    focus: { type: String, required: true },
    question_ids: { type: [String], required: true, default: [] },
    minutes: { type: Number, required: true },
  },
  { _id: false },
);

const sourceSchema = new Schema(
  {
    company: { type: String, required: true },
    company_url: { type: String, required: true },
    role: { type: String, required: true },
    location: { type: String, required: true },
    jd_chars: { type: Number, required: true },
    researched_at: { type: String, required: true },
    pages_used: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const companyBriefSchema = new Schema(
  {
    summary: { type: String, required: true },
    what_they_do: { type: String, required: true },
    sources: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const roleSchema = new Schema(
  {
    title: { type: String, required: true },
    seniority: { type: String, required: true },
    responsibilities: { type: [String], required: true, default: [] },
    requirements: { type: [requirementSchema], required: true, default: [] },
  },
  { _id: false },
);

const scheduleSchema = new Schema(
  {
    days_available: { type: Number, required: true },
    days: { type: [scheduleDaySchema], required: true, default: [] },
  },
  { _id: false },
);

const coverageSchema = new Schema(
  {
    uncovered_requirement_ids: { type: [String], required: true, default: [] },
    passes: { type: Number, required: true },
  },
  { _id: false },
);

const errorSchema = new Schema(
  {
    message: { type: String, required: true },
    details: { type: [String], required: false },
  },
  { _id: false },
);

const retrievedPageSchema = new Schema(
  {
    url: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const retrievalCacheSchema = new Schema(
  {
    company_pages: { type: [retrievedPageSchema], required: true, default: [] },
    discussion_snippets: { type: [retrievedPageSchema], required: true, default: [] },
  },
  { _id: false },
);

const kitSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'generating', 'ready', 'failed'],
      default: 'draft',
    },
    error: { type: errorSchema, required: false },
    // Internal only — not part of Appendix A / kitSchema, so
    // validateKitStructure never sees it. Needed so POST /:id/generate can
    // re-run the pipeline (including "Retry" after a failure) without the
    // client having to resend the original JD.
    jd: { type: String, required: false },
    // Internal only, excluded from serializeKit's response — the raw
    // company-page text and discussion snippets from the original
    // retrieval, cached so POST /:id/regenerate/company-brief can re-run
    // generateCompanyBrief without re-crawling the company's site (and
    // re-running discussion search) on every regenerate.
    _retrievalCache: { type: retrievalCacheSchema, required: false },
    source: { type: sourceSchema, required: false },
    company_brief: { type: companyBriefSchema, required: false },
    role: { type: roleSchema, required: false },
    questions: { type: [questionSchema], required: false, default: undefined },
    flashcards: { type: [flashcardSchema], required: false, default: undefined },
    schedule: { type: scheduleSchema, required: false },
    coverage: { type: coverageSchema, required: false },
  },
  { timestamps: true },
);

export type KitDocument = InferSchemaType<typeof kitSchema>;

export const KitModel = model('Kit', kitSchema);
