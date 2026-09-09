"use client";

import { useState, type FormEvent } from "react";
import type { Kit, KitRequirement, QuestionCategory } from "@/lib/kitTypes";
import { addQuestion } from "@/lib/kits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RequirementMultiSelect } from "@/components/kit/RequirementMultiSelect";

const CATEGORY_OPTIONS: { value: QuestionCategory; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioural", label: "Behavioural" },
  { value: "system-design", label: "System design" },
  { value: "company-fit", label: "Company fit" },
];

export function AddQuestionDialog({
  kitId,
  requirements,
  defaultCategory,
  onKitUpdate,
}: {
  kitId: string;
  requirements: KitRequirement[];
  defaultCategory: QuestionCategory;
  onKitUpdate: (kit: Kit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<QuestionCategory>(defaultCategory);
  const [requirementIds, setRequirementIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [answerOutline, setAnswerOutline] = useState("");
  const [difficulty, setDifficulty] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setCategory(defaultCategory);
    setRequirementIds([]);
    setPrompt("");
    setAnswerOutline("");
    setDifficulty("2");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || !answerOutline.trim()) {
      setError("Prompt and answer outline are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const kit = await addQuestion(kitId, {
        category,
        requirement_ids: requirementIds,
        prompt,
        answer_outline: answerOutline,
        difficulty: Number(difficulty) as 1 | 2 | 3,
      });
      onKitUpdate(kit);
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't add this question.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Add question</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a question</DialogTitle>
          <DialogDescription>
            Added as &quot;Manual&quot; — it will survive a category regenerate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-question-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as QuestionCategory)}>
              <SelectTrigger id="new-question-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RequirementMultiSelect
            requirements={requirements}
            selectedIds={requirementIds}
            onChange={setRequirementIds}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-question-prompt">Prompt</Label>
            <Textarea id="new-question-prompt" required value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-question-answer">Answer outline</Label>
            <Textarea
              id="new-question-answer"
              required
              value={answerOutline}
              onChange={(e) => setAnswerOutline(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-question-difficulty">Difficulty</Label>
            <Select value={difficulty} onValueChange={(value) => setDifficulty(value ?? "2")}>
              <SelectTrigger id="new-question-difficulty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Easy</SelectItem>
                <SelectItem value="2">2 — Medium</SelectItem>
                <SelectItem value="3">3 — Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
