import Link from "next/link";
import type { Kit } from "@/lib/kitTypes";
import { Button } from "@/components/ui/button";
import { KitHeader } from "@/components/kit/KitHeader";
import { CompanyBriefCard } from "@/components/kit/CompanyBriefCard";
import { RequirementList } from "@/components/kit/RequirementList";
import { QuestionBank } from "@/components/kit/QuestionBank";
import { FlashcardsSummary } from "@/components/kit/FlashcardsSummary";
import { ScheduleView } from "@/components/kit/ScheduleView";
import { CoverageAlert } from "@/components/kit/CoverageAlert";

/**
 * Read-only kit display, rendered from /kits/[id] once status is "ready".
 * Broken into small pieces under components/kit/ on purpose — the Phase 8
 * editable builder reuses and extends several of them rather than starting
 * from scratch.
 */
export function KitView({ kit }: { kit: Kit }) {
  const requirements = kit.role?.requirements ?? [];
  const questions = kit.questions ?? [];
  const flashcards = kit.flashcards ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" render={<Link href={`/kits/${kit.id}/edit`} />}>
          Edit
        </Button>
      </div>

      <KitHeader kit={kit} />

      {kit.coverage && (
        <CoverageAlert
          uncoveredRequirementIds={kit.coverage.uncovered_requirement_ids}
          requirements={requirements}
        />
      )}

      <CompanyBriefCard companyBrief={kit.company_brief} />

      <RequirementList responsibilities={kit.role?.responsibilities ?? []} requirements={requirements} />

      <QuestionBank questions={questions} />

      <FlashcardsSummary count={flashcards.length} kitId={kit.id} />

      <ScheduleView schedule={kit.schedule} questions={questions} />
    </div>
  );
}
