"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createKit, triggerGenerate, waitForKitCompletion } from "@/lib/kits";
import { parseBulkInput, type BulkKitEntry } from "@/lib/parseBulkKits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60];

export default function NewKitPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">New kit</h1>
      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single role</TabsTrigger>
          <TabsTrigger value="multiple">Multiple roles</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-6">
          <SingleRoleForm />
        </TabsContent>
        <TabsContent value="multiple" className="mt-6">
          <MultipleRolesForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SingleRoleForm() {
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!jd.trim() || !companyUrl.trim()) {
      setError("Please fill in the job description and company URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const kit = await createKit({ jd, company_url: companyUrl, days: Number(days) });
      await triggerGenerate(kit.id);
      router.push(`/kits/${kit.id}`);
    } catch {
      setError("Couldn't create this kit. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Generate a kit for one role</CardTitle>
        <CardDescription>Paste the job description and we&apos;ll research the company and build a study plan.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jd">Job description</Label>
            <Textarea
              id="jd"
              required
              rows={8}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company_url">Company URL</Label>
            <Input
              id="company_url"
              type="text"
              required
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://acme.example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="days">Days to prepare</Label>
            <Select value={days} onValueChange={(value) => setDays(String(value))}>
              <SelectTrigger id="days" className="w-full">
                <SelectValue placeholder="Select days" />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} day{n === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Starting..." : "Generate kit"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

type EntryStatus = "pending" | "creating" | "generating" | "done" | "failed";

interface BulkEntryState {
  entry: BulkKitEntry;
  status: EntryStatus;
  kitId?: string;
  error?: string;
}

function badgeVariantForEntry(status: EntryStatus) {
  switch (status) {
    case "done":
      return "default" as const;
    case "generating":
    case "creating":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function MultipleRolesForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [entries, setEntries] = useState<BulkKitEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [runStates, setRunStates] = useState<BulkEntryState[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setEntries(null);
    setRunStates(null);

    try {
      const text = await file.text();
      const parsed = parseBulkInput(text, file.name);
      if (parsed.length === 0) {
        throw new Error("No entries found in this file.");
      }
      setEntries(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Couldn't parse this file.");
    }
  }

  async function handleRun() {
    if (!entries) return;

    setIsRunning(true);
    const initial: BulkEntryState[] = entries.map((entry) => ({ entry, status: "pending" }));
    setRunStates(initial);

    // Sequential on purpose — mirrors the batch script's reasoning: running
    // many generations concurrently risks Groq's rate limits, so each kit
    // runs to completion before the next one starts.
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]!;

      setRunStates((prev) =>
        prev!.map((s, idx) => (idx === i ? { ...s, status: "creating" } : s)),
      );

      try {
        const kit = await createKit(entry);
        setRunStates((prev) =>
          prev!.map((s, idx) => (idx === i ? { ...s, status: "generating", kitId: kit.id } : s)),
        );

        await triggerGenerate(kit.id);
        const finalKit = await waitForKitCompletion(kit.id);

        setRunStates((prev) =>
          prev!.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: finalKit.status === "ready" ? "done" : "failed",
                  error: finalKit.error?.message,
                }
              : s,
          ),
        );
      } catch {
        setRunStates((prev) =>
          prev!.map((s, idx) => (idx === i ? { ...s, status: "failed", error: "Request failed" } : s)),
        );
      }
    }

    setIsRunning(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Generate kits for multiple roles</CardTitle>
        <CardDescription>
          Upload a .json or .csv file. Kits are created and generated one at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Expected format</p>
          <p className="mb-1">JSON — an array of entries:</p>
          <pre className="mb-3 overflow-x-auto rounded bg-background p-2">
{`[
  { "jd": "We are hiring...", "company_url": "https://acme.com", "days": 5 }
]`}
          </pre>
          <p className="mb-1">CSV — header row, quote fields containing commas:</p>
          <pre className="overflow-x-auto rounded bg-background p-2">
{`jd,company_url,days
"We need 3+ years Node.js, TypeScript",https://acme.com,5`}
          </pre>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-file">File</Label>
          <input
            ref={fileInputRef}
            id="bulk-file"
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            disabled={isRunning}
            className="text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm file:font-medium"
          />
          {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
        </div>

        {parseError && <p className="text-sm text-destructive">{parseError}</p>}

        {entries && !parseError && (
          <p className="text-sm text-muted-foreground">
            Parsed {entries.length} entr{entries.length === 1 ? "y" : "ies"}.
          </p>
        )}

        {runStates && (
          <ul className="flex flex-col gap-2">
            {runStates.map((state, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{state.entry.company_url}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {state.entry.jd.slice(0, 60)}
                    {state.entry.jd.length > 60 ? "..." : ""}
                  </p>
                  {state.error && <p className="text-xs text-destructive">{state.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badgeVariantForEntry(state.status)}>{state.status}</Badge>
                  {state.kitId && state.status !== "pending" && (
                    <a href={`/kits/${state.kitId}`} className="text-xs text-primary underline">
                      view
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleRun} disabled={!entries || isRunning} className="w-full">
          {isRunning ? "Generating..." : "Generate all"}
        </Button>
      </CardFooter>
    </Card>
  );
}
