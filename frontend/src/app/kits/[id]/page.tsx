"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { fetchKit, triggerGenerate } from "@/lib/kits";
import type { Kit } from "@/lib/kitTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KitView } from "@/components/KitView";

const POLL_INTERVAL_MS = 2000;

// Not wired to real backend progress — the pipeline doesn't report
// intermediate steps, so this is a static sequence timed to roughly match
// typical generation duration observed in practice (~60-120s). If the
// backend adds real step-reporting later, swap this for that instead.
const STEP_MESSAGES = [
  "Extracting requirements from the job description...",
  "Researching the company...",
  "Generating interview questions...",
  "Generating flashcards...",
  "Building your study schedule...",
];
const STEP_INTERVAL_MS = 15000;

export default function KitPage() {
  const params = useParams<{ id: string }>();
  const kitId = params.id;

  const [kit, setKit] = useState<Kit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      try {
        const nextKit = await fetchKit(kitId);
        if (cancelled) return;

        setKit(nextKit);

        if (nextKit.status !== "generating" && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } catch {
        if (!cancelled) {
          setLoadError("Couldn't load this kit.");
        }
      }
    }

    tick();
    pollTimer = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [kitId]);

  useEffect(() => {
    if (kit?.status !== "generating") {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      // No need to reset stepIndex here: it's only ever displayed while
      // status === "generating", and handleRetry resets it explicitly when
      // generation restarts.
      return;
    }

    if (stepTimerRef.current) return;

    stepTimerRef.current = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEP_MESSAGES.length - 1));
    }, STEP_INTERVAL_MS);

    return () => {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    };
  }, [kit?.status]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const updated = await triggerGenerate(kitId);
      setKit(updated);
      setStepIndex(0);
    } catch {
      setLoadError("Couldn't restart generation. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

  if (loadError && !kit) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  if (!kit) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (kit.status === "ready") {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <KitView kit={kit} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {kit.role?.title || kit.source?.role || "Kit"}
        </h1>
        <Badge variant={kit.status === "failed" ? "destructive" : "secondary"}>{kit.status}</Badge>
      </div>

      {kit.status === "generating" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generating your kit</CardTitle>
            <CardDescription>This usually takes a minute or two.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Progress value={null} />
            <p className="text-sm text-muted-foreground">{STEP_MESSAGES[stepIndex]}</p>
          </CardContent>
        </Card>
      )}

      {kit.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>
            <p>{kit.error?.message ?? "Something went wrong while generating this kit."}</p>
            {kit.error?.details && kit.error.details.length > 0 && (
              <ul className="mt-2 list-inside list-disc">
                {kit.error.details.map((detail, i) => (
                  <li key={i}>{detail}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
          <div className="mt-3">
            <Button size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </Alert>
      )}

      {kit.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Not started yet</CardTitle>
            <CardDescription>Generation hasn&apos;t been triggered for this kit.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRetry} disabled={retrying}>
              {retrying ? "Starting..." : "Generate"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
