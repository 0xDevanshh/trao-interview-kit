"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchPracticeSession, reviewFlashcard, type PracticeSessionResponse } from "@/lib/kits";
import type { KitFlashcard } from "@/lib/kitTypes";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CONFIDENCE_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "Didn't know it" },
  { value: 2, label: "Sort of knew it" },
  { value: 3, label: "Knew it cold" },
];

export default function PracticeKitPage() {
  const params = useParams<{ id: string }>();
  const kitId = params.id;

  const [cards, setCards] = useState<KitFlashcard[] | null>(null);
  const [coveredCount, setCoveredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((session: PracticeSessionResponse) => {
    setCards(session.flashcards);
    setCoveredCount(session.coveredCount);
    setTotalCount(session.totalCount);
    setCurrentIndex(0);
    setRevealed(false);
    setSessionComplete(false);
  }, []);

  // Fetch on mount. setState only happens inside the promise continuation,
  // never synchronously in the effect body — the sanctioned pattern for
  // effect-driven data fetching.
  useEffect(() => {
    let cancelled = false;

    fetchPracticeSession(kitId)
      .then((session) => {
        if (!cancelled) applySession(session);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the practice session.");
      });

    return () => {
      cancelled = true;
    };
  }, [kitId, applySession]);

  async function handlePracticeAgain() {
    setError(null);
    try {
      const session = await fetchPracticeSession(kitId);
      applySession(session);
    } catch {
      setError("Couldn't load the practice session.");
    }
  }

  const currentCard = cards && !sessionComplete ? cards[currentIndex] : undefined;

  const handleConfidence = useCallback(
    async (confidence: 1 | 2 | 3) => {
      if (!currentCard || !cards || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await reviewFlashcard(kitId, currentCard.id, confidence);

        // A card is "covered" the first time it's ever reviewed — track
        // that locally rather than refetching the whole session just to
        // get an updated count.
        const wasNeverReviewed = (currentCard.practice?.timesReviewed ?? 0) === 0;
        if (wasNeverReviewed) {
          setCoveredCount((count) => count + 1);
        }

        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((index) => index + 1);
          setRevealed(false);
        } else {
          setSessionComplete(true);
        }
      } catch {
        setError("Couldn't record that review. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentCard, cards, currentIndex, kitId, isSubmitting],
  );

  // Space/Enter reveals the answer; 1/2/3 record confidence once revealed.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!cards || cards.length === 0 || sessionComplete || isSubmitting) return;

      if (!revealed) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setRevealed(true);
        }
        return;
      }

      if (event.key === "1" || event.key === "2" || event.key === "3") {
        event.preventDefault();
        handleConfidence(Number(event.key) as 1 | 2 | 3);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cards, sessionComplete, revealed, isSubmitting, handleConfidence]);

  if (error && !cards) {
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!cards) {
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No flashcards yet</CardTitle>
            <CardDescription>
              This kit doesn&apos;t have any flashcards to practice with yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href={`/kits/${kitId}`} />}>
              Back to kit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercent = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Practice</h1>
        <Button variant="outline" size="sm" render={<Link href={`/kits/${kitId}`} />}>
          Exit
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {coveredCount} of {totalCount} covered
          </span>
          {!sessionComplete && (
            <span>
              Card {currentIndex + 1} of {cards.length}
            </span>
          )}
        </div>
        <Progress value={progressPercent} />
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {sessionComplete ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session complete</CardTitle>
            <CardDescription>
              {coveredCount} of {totalCount} flashcards ever covered.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button onClick={handlePracticeAgain}>Practice again</Button>
            <Button variant="outline" render={<Link href={`/kits/${kitId}`} />}>
              Back to kit
            </Button>
          </CardContent>
        </Card>
      ) : (
        currentCard && (
          <Card>
            <CardContent className="flex min-h-40 flex-col items-center justify-center gap-4 py-8 text-center">
              <p className="text-lg text-foreground">{currentCard.front}</p>
              {revealed && (
                <p className="border-t border-border pt-4 text-sm text-muted-foreground">{currentCard.back}</p>
              )}
            </CardContent>
            <div className="flex flex-col gap-2 border-t border-border p-4">
              {!revealed ? (
                <Button onClick={() => setRevealed(true)} autoFocus>
                  Reveal answer
                </Button>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => handleConfidence(option.value)}
                    >
                      {option.label}
                      <span className="ml-1 text-xs text-muted-foreground">({option.value})</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )
      )}
    </div>
  );
}
