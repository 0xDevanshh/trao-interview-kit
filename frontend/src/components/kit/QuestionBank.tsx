"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, MoreVerticalIcon } from "lucide-react";
import type { Kit, KitQuestion, KitRequirement, QuestionCategory } from "@/lib/kitTypes";
import { deleteQuestion, moveQuestion, reorderQuestions, updateQuestion } from "@/lib/kits";
import { requirementAnchorId } from "@/components/kit/RequirementList";
import { SourceBadge } from "@/components/kit/SourceBadge";
import { InlineEditableText } from "@/components/kit/InlineEditableText";
import { AddQuestionDialog } from "@/components/kit/AddQuestionDialog";
import { RegenerateCategoryButton } from "@/components/kit/RegenerateCategoryButton";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioural", label: "Behavioural" },
  { value: "system-design", label: "System design" },
  { value: "company-fit", label: "Company fit" },
];

function DifficultyDots({ difficulty }: { difficulty: KitQuestion["difficulty"] }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Difficulty ${difficulty} of 3`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`size-1.5 rounded-full ${n <= difficulty ? "bg-foreground" : "bg-muted"}`} />
      ))}
    </span>
  );
}

interface QuestionItemProps {
  question: KitQuestion;
  editable: boolean;
  kitId?: string;
  onKitUpdate?: (kit: Kit) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function QuestionItem({
  question,
  editable,
  kitId,
  onKitUpdate,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: QuestionItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handlePromptSave(next: string) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await updateQuestion(kitId, question.id, { prompt: next }));
  }

  async function handleAnswerSave(next: string) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await updateQuestion(kitId, question.id, { answer_outline: next }));
  }

  async function handleMove(newCategory: QuestionCategory) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await moveQuestion(kitId, question.id, newCategory));
  }

  async function handleDelete() {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await deleteQuestion(kitId, question.id));
  }

  return (
    <Collapsible className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editable ? (
            <InlineEditableText value={question.prompt} onSave={handlePromptSave} label="question prompt" />
          ) : (
            <p className="text-sm text-foreground">{question.prompt}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SourceBadge source={question.source} />
          <DifficultyDots difficulty={question.difficulty} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
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

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Move up">
              <ChevronUpIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Move down">
              <ChevronDownIcon />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="More actions" />}>
                <MoreVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Move to category</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {CATEGORIES.filter((c) => c.value !== question.category).map((c) => (
                      <DropdownMenuItem key={c.value} onClick={() => handleMove(c.value)}>
                        {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Controlled, not nested inside the DropdownMenu — selecting a menu
                item unmounts the menu (and any trigger inside it) before a
                nested Dialog would get a chance to open. */}
            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete this question?"
              description="This can't be undone."
              confirmLabel="Delete"
              destructive
              onConfirm={handleDelete}
            />
          </div>
        )}
      </div>

      <CollapsibleContent className="mt-2 text-sm text-muted-foreground">
        {editable ? (
          <InlineEditableText value={question.answer_outline} onSave={handleAnswerSave} label="answer outline" />
        ) : (
          question.answer_outline
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface QuestionBankProps {
  questions: KitQuestion[];
  editable?: boolean;
  kitId?: string;
  requirements?: KitRequirement[];
  onKitUpdate?: (kit: Kit) => void;
}

export function QuestionBank({
  questions,
  editable = false,
  kitId,
  requirements = [],
  onKitUpdate,
}: QuestionBankProps) {
  async function handleReorder(categoryQuestions: KitQuestion[], fromIndex: number, toIndex: number) {
    if (!kitId || !onKitUpdate) return;
    const ids = categoryQuestions.map((q) => q.id);
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved!);
    onKitUpdate(await reorderQuestions(kitId, categoryQuestions[0]!.category, ids));
  }

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
              <TabsContent key={category.value} value={category.value} className="mt-4 flex flex-col gap-3">
                {editable && kitId && onKitUpdate && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <AddQuestionDialog
                      kitId={kitId}
                      requirements={requirements}
                      defaultCategory={category.value}
                      onKitUpdate={onKitUpdate}
                    />
                    <RegenerateCategoryButton
                      kitId={kitId}
                      category={category.value}
                      questions={questions}
                      onKitUpdate={onKitUpdate}
                    />
                  </div>
                )}

                {categoryQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No {category.label.toLowerCase()} questions.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {categoryQuestions.map((question, index) => (
                      <QuestionItem
                        key={question.id}
                        question={question}
                        editable={editable}
                        kitId={kitId}
                        onKitUpdate={onKitUpdate}
                        canMoveUp={index > 0}
                        canMoveDown={index < categoryQuestions.length - 1}
                        onMoveUp={() => handleReorder(categoryQuestions, index, index - 1)}
                        onMoveDown={() => handleReorder(categoryQuestions, index, index + 1)}
                      />
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
