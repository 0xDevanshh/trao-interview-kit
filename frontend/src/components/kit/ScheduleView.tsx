import type { Kit, KitQuestion } from "@/lib/kitTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function ScheduleView({
  schedule,
  questions,
}: {
  schedule: Kit["schedule"];
  questions: KitQuestion[];
}) {
  if (!schedule) return null;

  const questionById = new Map(questions.map((q) => [q.id, q]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Study schedule</CardTitle>
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
