import type { Kit } from "@/lib/kitTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CompanyBriefCard({ companyBrief }: { companyBrief: Kit["company_brief"] }) {
  if (!companyBrief) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Company brief</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground">{companyBrief.summary}</p>
        {companyBrief.what_they_do && (
          <p className="text-sm text-muted-foreground">{companyBrief.what_they_do}</p>
        )}
        {companyBrief.sources.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Sources</p>
            <ul className="flex flex-col gap-1">
              {companyBrief.sources.map((url) => (
                <li key={url} className="truncate">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
