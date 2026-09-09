"use client";

import type { KitQuestion } from "@/lib/kitTypes";
import { requirementAnchorId } from "@/components/kit/RequirementList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES: { value: KitQuestion["category"]; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioural", label: "Behavioural" },
  { value: "system-design", label: "System design" },
  { value: "company-fit", label: "Company fit" },
];

function DifficultyDots({ difficulty }: { difficulty: KitQuestion["difficulty"] }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Difficulty ${difficulty} of 3`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`size-1.5 rounded-full ${n <= difficulty ? "bg-foreground" : "bg-muted"}`}
        />
      ))}
    </span>
  );
}

function QuestionItem({ question }: { question: KitQuestion }) {
  return (
    <Collapsible className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground">{question.prompt}</p>
        <DifficultyDots difficulty={question.difficulty} />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <CollapsibleTrigger className="text-xs font-medium text-primary underline underline-offset-2">
          Show answer outline
        </CollapsibleTrigger>
        {question.requirement_ids.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Covers:{" "}
            {question.requirement_ids.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <a href={`#${requirementAnchorId(id)}`} className="underline underline-offset-2">
                  {id}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>

      <CollapsibleContent className="mt-2 text-sm text-muted-foreground">
        {question.answer_outline}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function QuestionBank({ questions }: { questions: KitQuestion[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Question bank</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="technical">
          <TabsList>
            {CATEGORIES.map((category) => (
              <TabsTrigger key={category.value} value={category.value}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {CATEGORIES.map((category) => {
            const categoryQuestions = questions.filter((q) => q.category === category.value);
            return (
              <TabsContent key={category.value} value={category.value} className="mt-4">
                {categoryQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No {category.label.toLowerCase()} questions.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {categoryQuestions.map((question) => (
                      <QuestionItem key={question.id} question={question} />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
