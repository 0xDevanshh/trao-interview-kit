"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder route — practice mode is Phase 9's job. Wired now so the
// "Practice" button from KitView has somewhere to go.
export default function PracticeKitPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Practice mode coming soon</CardTitle>
          <CardDescription>Flashcard practice isn&apos;t built yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" render={<Link href={`/kits/${params.id}`} />}>
            Back to kit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
