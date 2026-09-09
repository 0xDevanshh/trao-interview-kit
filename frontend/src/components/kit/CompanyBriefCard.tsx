"use client";

import { useState } from "react";
import type { Kit } from "@/lib/kitTypes";
import { regenerateCompanyBrief, updateCompanyBrief } from "@/lib/kits";
import { InlineEditableText } from "@/components/kit/InlineEditableText";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CompanyBriefCardProps {
  kitId?: string;
  companyBrief: Kit["company_brief"];
  editable?: boolean;
  onKitUpdate?: (kit: Kit) => void;
}

export function CompanyBriefCard({ kitId, companyBrief, editable = false, onKitUpdate }: CompanyBriefCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!companyBrief) return null;

  async function handleSummarySave(next: string) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await updateCompanyBrief(kitId, { summary: next }));
  }

  async function handleWhatTheyDoSave(next: string) {
    if (!kitId || !onKitUpdate) return;
    onKitUpdate(await updateCompanyBrief(kitId, { what_they_do: next }));
  }

  async function handleRegenerate() {
    if (!kitId || !onKitUpdate) return;
    setIsRegenerating(true);
    try {
      onKitUpdate(await regenerateCompanyBrief(kitId));
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-lg">Company brief</CardTitle>
        {editable && kitId && onKitUpdate && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" disabled={isRegenerating}>
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            }
            title="Regenerate company brief?"
            description="This overwrites the summary and what-they-do text entirely, including any edits you've made — company brief is a single section, not something regenerated field-by-field like questions or flashcards."
            confirmLabel="Regenerate"
            onConfirm={handleRegenerate}
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editable ? (
          <InlineEditableText value={companyBrief.summary} onSave={handleSummarySave} label="company brief summary" />
        ) : (
          <p className="text-sm text-foreground">{companyBrief.summary}</p>
        )}

        {editable ? (
          <InlineEditableText
            value={companyBrief.what_they_do}
            onSave={handleWhatTheyDoSave}
            label="what the company does"
            placeholder="What does this company do? Click to add..."
          />
        ) : (
          companyBrief.what_they_do && <p className="text-sm text-muted-foreground">{companyBrief.what_they_do}</p>
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
