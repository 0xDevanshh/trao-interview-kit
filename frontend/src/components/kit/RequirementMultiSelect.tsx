import type { KitRequirement } from "@/lib/kitTypes";
import { Label } from "@/components/ui/label";

/**
 * Plain HTML checkboxes rather than a shadcn combobox — natively keyboard
 * accessible (Tab + Space) without any extra wiring, and there's no need
 * for a searchable dropdown at the scale of one kit's requirement list.
 */
export function RequirementMultiSelect({
  requirements,
  selectedIds,
  onChange,
}: {
  requirements: KitRequirement[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Requirements covered</Label>
      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-lg border border-input p-2">
        {requirements.length === 0 && <p className="text-xs text-muted-foreground">No requirements on this kit.</p>}
        {requirements.map((req) => (
          <label key={req.id} className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={selectedIds.includes(req.id)}
              onChange={() => toggle(req.id)}
              className="mt-0.5"
            />
            <span>{req.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
