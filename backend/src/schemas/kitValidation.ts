import { kitSchema, type Kit } from './kitSchema.js';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateKitStructure(kit: unknown): ValidationResult {
  const result = kitSchema.safeParse(kit);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || '(root)';
      return `${path}: ${issue.message}`;
    });
    return { valid: false, errors };
  }

  const errors = checkReferentialIntegrity(result.data);
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

function checkReferentialIntegrity(kit: Kit): string[] {
  const errors: string[] = [];
  const allIds = new Set<string>();

  function claimId(id: string, description: string): void {
    if (allIds.has(id)) {
      errors.push(`Duplicate id "${id}" (${description}) is used more than once in the kit`);
    }
    allIds.add(id);
  }

  const requirementIds = new Set<string>();
  for (const requirement of kit.role.requirements) {
    claimId(requirement.id, `requirement ${requirement.id}`);
    requirementIds.add(requirement.id);
  }

  const questionIds = new Set<string>();
  for (const question of kit.questions) {
    claimId(question.id, `question ${question.id}`);
    questionIds.add(question.id);

    for (const reqId of question.requirement_ids) {
      if (!requirementIds.has(reqId)) {
        errors.push(`Question "${question.id}" references nonexistent requirement id "${reqId}"`);
      }
    }
  }

  for (const flashcard of kit.flashcards) {
    claimId(flashcard.id, `flashcard ${flashcard.id}`);

    for (const reqId of flashcard.requirement_ids) {
      if (!requirementIds.has(reqId)) {
        errors.push(`Flashcard "${flashcard.id}" references nonexistent requirement id "${reqId}"`);
      }
    }
  }

  for (const day of kit.schedule.days) {
    for (const qId of day.question_ids) {
      if (!questionIds.has(qId)) {
        errors.push(`Schedule day ${day.day} references nonexistent question id "${qId}"`);
      }
    }
  }

  return errors;
}
