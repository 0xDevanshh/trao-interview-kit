"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { KitSummary } from "@/lib/kitTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusBadgeVariant(status: KitSummary["status"]) {
  switch (status) {
    case "ready":
      return "default" as const;
    case "generating":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export default function DashboardPage() {
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await api.get<{ kits: KitSummary[] }>("/api/kits");
        if (!cancelled) {
          setKits(data.kits);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load your kits. Please try again.");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your kits</h1>
          <p className="text-sm text-muted-foreground">Interview prep kits you&apos;ve generated.</p>
        </div>
        <Button render={<Link href="/kits/new" />}>New Kit</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {kits === null && !error && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {kits !== null && kits.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">No kits yet.</p>
            <Button render={<Link href="/kits/new" />}>Create your first kit</Button>
          </CardContent>
        </Card>
      )}

      {kits !== null && kits.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {kits.map((kit) => (
            <Link key={kit.id} href={`/kits/${kit.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{kit.title}</CardTitle>
                    <Badge variant={statusBadgeVariant(kit.status)}>{kit.status}</Badge>
                  </div>
                  <CardDescription>
                    Created {new Date(kit.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
