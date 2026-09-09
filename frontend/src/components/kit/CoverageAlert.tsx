import type { KitRequirement } from "@/lib/kitTypes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CoverageAlert({
  uncoveredRequirementIds,
  requirements,
}: {
  uncoveredRequirementIds: string[];
  requirements: KitRequirement[];
}) {
  if (uncoveredRequirementIds.length === 0) return null;

  const byId = new Map(requirements.map((r) => [r.id, r]));

  return (
    <Alert variant="destructive">
      <AlertTitle>Some requirements aren&apos;t covered by any question</AlertTitle>
      <AlertDescription>
        <p>
          {uncoveredRequirementIds.length} requirement{uncoveredRequirementIds.length === 1 ? "" : "s"} remain
          uncovered even after the coverage passes — this is a real gap, not a display bug:
        </p>
        <ul className="mt-2 list-inside list-disc">
          {uncoveredRequirementIds.map((id) => (
            <li key={id}>{byId.get(id)?.text ?? id}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
