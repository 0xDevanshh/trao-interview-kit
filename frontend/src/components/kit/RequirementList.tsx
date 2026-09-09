import type { KitRequirement } from "@/lib/kitTypes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function kindBadgeVariant(kind: KitRequirement["kind"]) {
  switch (kind) {
    case "technical":
      return "secondary" as const;
    case "behavioural":
      return "outline" as const;
    case "domain":
      return "ghost" as const;
  }
}

export function requirementAnchorId(requirementId: string): string {
  return `requirement-${requirementId}`;
}

export function RequirementList({
  responsibilities,
  requirements,
}: {
  responsibilities: string[];
  requirements: KitRequirement[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Role breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {responsibilities.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Responsibilities</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {responsibilities.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {requirements.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Requirements</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req) => (
                  <TableRow key={req.id} id={requirementAnchorId(req.id)}>
                    <TableCell className="whitespace-normal text-sm text-foreground">{req.text}</TableCell>
                    <TableCell>
                      <Badge variant={kindBadgeVariant(req.kind)}>{req.kind}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={req.priority === "must" ? "default" : "outline"}>{req.priority}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
