"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from "lucide-react";
import type { Kit, KitFlashcard, KitRequirement } from "@/lib/kitTypes";
import { deleteFlashcard, reorderFlashcards, updateFlashcard } from "@/lib/kits";
import { requirementAnchorId } from "@/components/kit/RequirementList";
import { SourceBadge } from "@/components/kit/SourceBadge";
import { InlineEditableText } from "@/components/kit/InlineEditableText";
import { AddFlashcardDialog } from "@/components/kit/AddFlashcardDialog";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Same edit/add/delete/source-badge pattern as QuestionBank, but simpler —
 * no categories, so no tabs and no category-scoped regenerate. This is a
 * dedicated edit-mode component (used by the builder), separate from
 * FlashcardsSummary (the read-view's count + Practice link).
 */

interface FlashcardItemProps {
  flashcard: KitFlashcard;
  editable: boolean;
  kitId?: string;
  onKitUpdate?: (kit: Kit) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FlashcardItem({
  flashcard,
  editable,
  kitId,
  onKitUpdate,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: FlashcardItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleFrontSave(next: string) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await updateFlashcard(kitId, flashcard.id, { front: next }));
  }

  async function handleBackSave(next: string) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await updateFlashcard(kitId, flashcard.id, { back: next }));
  }

  async function handleDelete() {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await deleteFlashcard(kitId, flashcard.id));
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Front</p>
          {editable ? (
            <InlineEditableText value={flashcard.front} onSave={handleFrontSave} label="flashcard front" />
          ) : (
            <p className="text-sm text-foreground">{flashcard.front}</p>
          )}
        </div>
        <SourceBadge source={flashcard.source} />
      </div>

      <div className="mt-2">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Back</p>
        {editable ? (
          <InlineEditableText value={flashcard.back} onSave={handleBackSave} label="flashcard back" />
        ) : (
          <p className="text-sm text-muted-foreground">{flashcard.back}</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        {flashcard.requirement_ids.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Covers:{" "}
            {flashcard.requirement_ids.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <a href={`#${requirementAnchorId(id)}`} className="underline underline-offset-2">
                  {id}
                </a>
              </span>
            ))}
          </p>
        )}

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Move up">
              <ChevronUpIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Move down">
              <ChevronDownIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete flashcard"
            >
              <Trash2Icon />
            </Button>
            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete this flashcard?"
              description="This can't be undone."
              confirmLabel="Delete"
              destructive
              onConfirm={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface FlashcardListProps {
  flashcards: KitFlashcard[];
  editable?: boolean;
  kitId?: string;
  requirements?: KitRequirement[];
  onKitUpdate?: (kit: Kit) => void;
}

export function FlashcardList({
  flashcards,
  editable = false,
  kitId,
  requirements = [],
  onKitUpdate,
}: FlashcardListProps) {
  async function handleReorder(fromIndex: number, toIndex: number) {
    if (!kitId || !onKitUpdate) return;
    const ids = flashcards.map((f) => f.id);
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved!);
    onKitUpdate(await reorderFlashcards(kitId, ids));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Flashcards</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editable && kitId && onKitUpdate && (
          <AddFlashcardDialog kitId={kitId} requirements={requirements} onKitUpdate={onKitUpdate} />
        )}

        {flashcards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flashcards yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {flashcards.map((flashcard, index) => (
              <FlashcardItem
                key={flashcard.id}
                flashcard={flashcard}
                editable={editable}
                kitId={kitId}
                onKitUpdate={onKitUpdate}
                canMoveUp={index > 0}
                canMoveDown={index < flashcards.length - 1}
                onMoveUp={() => handleReorder(index, index - 1)}
                onMoveDown={() => handleReorder(index, index + 1)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
