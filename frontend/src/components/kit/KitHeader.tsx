import type { Kit } from "@/lib/kitTypes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function KitHeader({ kit }: { kit: Kit }) {
  const role = kit.role;
  const source = kit.source;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-2xl">{role?.title || source?.role || "Untitled role"}</CardTitle>
            <CardDescription>
              {source?.company}
              {source?.location ? ` · ${source.location}` : ""}
            </CardDescription>
          </div>
          {role?.seniority && <Badge variant="secondary">{role.seniority}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {source?.researched_at && (
          <p className="text-xs text-muted-foreground">Researched {formatDate(source.researched_at)}</p>
        )}
      </CardContent>
    </Card>
  );
}
