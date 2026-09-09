"use client";

import { useState } from "react";
import type { Kit, KitQuestion, QuestionCategory } from "@/lib/kitTypes";
import { regenerateQuestionsCategory } from "@/lib/kits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";

export function RegenerateCategoryButton({
  kitId,
  category,
  questions,
  onKitUpdate,
}: {
  kitId: string;
  category: QuestionCategory;
  questions: KitQuestion[];
  onKitUpdate: (kit: Kit) => void;
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const unlockedCount = questions.filter(
    (q) => q.category === category && (q.source ?? "generated") === "generated",
  ).length;

  async function handleConfirm() {
    setIsRegenerating(true);
    try {
      const result = await regenerateQuestionsCategory(kitId, category);
      onKitUpdate(result.kit);
      if (result.newly_uncovered_requirement_ids.length > 0) {
        // A full toast system is out of scope here, but silently swallowing
        // a coverage regression would defeat the point of surfacing it at
        // all — the persistent CoverageAlert on the read view reflects the
        // same thing going forward.
        window.alert(
          `Heads up: ${result.newly_uncovered_requirement_ids.length} requirement(s) are no longer covered by any question. Check the Coverage section.`,
        );
      }
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isRegenerating}>
          {isRegenerating ? "Regenerating..." : "Regenerate this category"}
        </Button>
      }
      title={`Regenerate ${category} questions?`}
      description={`This replaces ${unlockedCount} non-locked question${unlockedCount === 1 ? "" : "s"} in this category with freshly generated ones. Edited and manually-added questions are kept.`}
      confirmLabel="Regenerate"
      onConfirm={handleConfirm}
    />
  );
}
