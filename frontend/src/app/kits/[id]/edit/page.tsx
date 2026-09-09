"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchKit } from "@/lib/kits";
import type { Kit } from "@/lib/kitTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KitHeader } from "@/components/kit/KitHeader";
import { CoverageAlert } from "@/components/kit/CoverageAlert";
import { CompanyBriefCard } from "@/components/kit/CompanyBriefCard";
import { RequirementList } from "@/components/kit/RequirementList";
import { QuestionBank } from "@/components/kit/QuestionBank";
import { FlashcardList } from "@/components/kit/FlashcardList";
import { ScheduleView } from "@/components/kit/ScheduleView";

export default function EditKitPage() {
  const params = useParams<{ id: string }>();
  const kitId = params.id;

  const [kit, setKit] = useState<Kit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchKit(kitId)
      .then((loaded) => {
        if (!cancelled) setKit(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this kit.");
      });

    return () => {
      cancelled = true;
    };
  }, [kitId]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!kit) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (kit.status !== "ready") {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nothing to edit yet</CardTitle>
            <CardDescription>
              This kit is still {kit.status === "generating" ? "generating" : kit.status}. Editing is only
              available once it&apos;s ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href={`/kits/${kitId}`} />}>
              Back to kit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requirements = kit.role?.requirements ?? [];
  const questions = kit.questions ?? [];
  const flashcards = kit.flashcards ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Edit kit</h1>
        <Button variant="outline" render={<Link href={`/kits/${kitId}`} />}>
          Done editing
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <KitHeader kit={kit} />

        {kit.coverage && (
          <CoverageAlert
            uncoveredRequirementIds={kit.coverage.uncovered_requirement_ids}
            requirements={requirements}
          />
        )}

        <CompanyBriefCard kitId={kit.id} companyBrief={kit.company_brief} editable onKitUpdate={setKit} />

        <RequirementList responsibilities={kit.role?.responsibilities ?? []} requirements={requirements} />

        <QuestionBank
          questions={questions}
          editable
          kitId={kit.id}
          requirements={requirements}
          onKitUpdate={setKit}
        />

        <FlashcardList
          flashcards={flashcards}
          editable
          kitId={kit.id}
          requirements={requirements}
          onKitUpdate={setKit}
        />

        <ScheduleView kitId={kit.id} schedule={kit.schedule} questions={questions} editable onKitUpdate={setKit} />
      </div>
    </div>
  );
}
