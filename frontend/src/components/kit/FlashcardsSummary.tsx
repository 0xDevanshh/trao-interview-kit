import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FlashcardsSummary({ count, kitId }: { count: number; kitId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Flashcards</CardTitle>
        <CardDescription>
          {count} flashcard{count === 1 ? "" : "s"} ready for quick review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button render={<Link href={`/kits/${kitId}/practice`} />} disabled={count === 0}>
          Practice
        </Button>
      </CardContent>
    </Card>
  );
}
