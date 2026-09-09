"use client";

import { useState, type FormEvent } from "react";
import type { Kit, KitRequirement } from "@/lib/kitTypes";
import { addFlashcard } from "@/lib/kits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function AddFlashcardDialog({
  kitId,
  requirements,
  onKitUpdate,
}: {
  kitId: string;
  requirements: KitRequirement[];
  onKitUpdate: (kit: Kit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [requirementIds, setRequirementIds] = useState<string[]>([]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setRequirementIds([]);
    setFront("");
    setBack("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError("Front and back are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const kit = await addFlashcard(kitId, { front, back, requirement_ids: requirementIds });
      onKitUpdate(kit);
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't add this flashcard.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Add flashcard</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a flashcard</DialogTitle>
          <DialogDescription>Added as &quot;Manual&quot;.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-flashcard-front">Front</Label>
            <Textarea id="new-flashcard-front" required value={front} onChange={(e) => setFront(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-flashcard-back">Back</Label>
            <Textarea id="new-flashcard-back" required value={back} onChange={(e) => setBack(e.target.value)} />
          </div>

          <RequirementMultiSelect
            requirements={requirements}
            selectedIds={requirementIds}
            onChange={setRequirementIds}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add flashcard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
