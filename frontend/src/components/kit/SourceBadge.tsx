import type { EditableItemSource } from "@/lib/kitTypes";
import { Badge } from "@/components/ui/badge";

/**
 * Deliberately shows nothing for plain "generated" items — the whole point
 * is surfacing what's locked (and therefore survives a regenerate), not
 * labeling every item. A user should be able to tell at a glance what
 * they've touched.
 */
export function SourceBadge({ source }: { source?: EditableItemSource }) {
  if (!source || source === "generated") return null;

  return (
    <Badge variant={source === "manual" ? "secondary" : "outline"}>
      {source === "manual" ? "Manual" : "Edited"}
    </Badge>
  );
}
