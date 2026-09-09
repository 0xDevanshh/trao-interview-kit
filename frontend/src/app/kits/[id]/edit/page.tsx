"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder route — the editable builder is Phase 8's job. Wired now so
// the "Edit" link from KitView has somewhere to go.
export default function EditKitPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Editing coming soon</CardTitle>
          <CardDescription>The kit builder isn&apos;t built yet.</CardDescription>
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
