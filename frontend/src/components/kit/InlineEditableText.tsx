"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedCallback } from "@/lib/useDebouncedCallback";

interface InlineEditableTextProps {
  value: string;
  onSave: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
}

const DEBOUNCE_MS = 500;

/**
 * Click-to-edit text: shows plain text until clicked, then becomes a
 * Textarea. Saves are debounced 500ms after typing stops, AND flushed
 * immediately on blur (so a save is never silently lost if the user tabs
 * away before the debounce fires) — both mechanisms feed the same onSave,
 * guarded against re-sending an already-sent value. Escape reverts to
 * whatever was last saved.
 */
export function InlineEditableText({
  value,
  onSave,
  label,
  placeholder,
  className,
  textareaClassName,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Set only from event handlers (entering edit mode, blur, the debounced
  // commit's timeout callback) — never during render — so this never trips
  // the "no ref mutation during render" rule.
  const lastSentRef = useRef(value);

  const debouncedCommit = useDebouncedCallback((next: string) => {
    if (next !== lastSentRef.current) {
      lastSentRef.current = next;
      onSave(next);
    }
  }, DEBOUNCE_MS);

  function startEditing() {
    setDraft(value);
    lastSentRef.current = value;
    setIsEditing(true);
  }

  function handleChange(next: string) {
    setDraft(next);
    debouncedCommit(next);
  }

  function handleBlur() {
    if (draft !== lastSentRef.current) {
      lastSentRef.current = draft;
      onSave(draft);
    }
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      setDraft(value);
      setIsEditing(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Edit ${label}`}
        className={`-mx-1 block w-full rounded px-1 py-0.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none ${className ?? ""}`}
      >
        {value || <span className="text-muted-foreground">{placeholder ?? "Click to add..."}</span>}
      </button>
    );
  }

  return (
    <Textarea
      autoFocus
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label={label}
      className={textareaClassName}
    />
  );
}
