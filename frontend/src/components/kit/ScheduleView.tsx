"use client";

import { useState } from "react";
import type { Kit, KitQuestion } from "@/lib/kitTypes";
import { regenerateSchedule } from "@/lib/kits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ScheduleViewProps {
  kitId?: string;
  schedule: Kit["schedule"];
  questions: KitQuestion[];
  editable?: boolean;
  onKitUpdate?: (kit: Kit) => void;
}

/**
 * Read-only display — the schedule is derived from the current question
 * set, not hand-edited. "Recompute" re-runs allocateSchedule server-side,
 * useful after adding/removing/moving questions changes what should be
 * scheduled.
 */
export function ScheduleView({ kitId, schedule, questions, editable = false, onKitUpdate }: ScheduleViewProps) {
  const [isRecomputing, setIsRecomputing] = useState(false);

  if (!schedule) return null;

  const questionById = new Map(questions.map((q) => [q.id, q]));

  async function handleRecompute() {
    if (!kitId || !onKitUpdate) return;
    setIsRecomputing(true);
    try {
      onKitUpdate(await regenerateSchedule(kitId));
    } finally {
      setIsRecomputing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">Study schedule</CardTitle>
        {editable && kitId && onKitUpdate && (
          <Button variant="outline" size="sm" onClick={handleRecompute} disabled={isRecomputing}>
            {isRecomputing ? "Recomputing..." : "Recompute schedule"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Accordion defaultValue={[schedule.days[0]?.day]}>
          {schedule.days.map((day) => (
            <AccordionItem key={day.day} value={day.day}>
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between pr-4">
                  <span>
                    Day {day.day} — {day.focus}
                  </span>
                  <span className="text-xs text-muted-foreground">{day.minutes} min</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {day.question_ids.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions scheduled — a lighter day.</p>
                ) : (
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {day.question_ids.map((id) => (
                      <li key={id}>{questionById.get(id)?.prompt ?? id}</li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
