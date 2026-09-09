"use client";

import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-3 text-muted">
        Signed in as {user?.email}. Kit list coming in Phase 7.
      </p>
    </div>
  );
}
