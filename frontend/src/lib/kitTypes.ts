export type KitStatus = "draft" | "generating" | "ready" | "failed";

export interface KitSummary {
  id: string;
  title: string;
  status: KitStatus;
  createdAt: string;
}

export interface KitRequirement {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
}

export type EditableItemSource = "generated" | "edited" | "manual";

export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";

export interface KitQuestion {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  source?: EditableItemSource;
}

export interface KitFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  source?: EditableItemSource;
}

export interface KitScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Kit {
  id: string;
  status: KitStatus;
  error: { message: string; details?: string[] } | null;
  createdAt: string;
  updatedAt: string;
  source?: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief?: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };
  role?: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: KitRequirement[];
  };
  questions?: KitQuestion[];
  flashcards?: KitFlashcard[];
  schedule?: {
    days_available: number;
    days: KitScheduleDay[];
  };
  coverage?: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
}
