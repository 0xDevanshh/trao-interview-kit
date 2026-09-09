"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export function NavAuthControls() {
  const router = useRouter();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted">{user?.email}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="text-muted hover:text-foreground"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 text-sm">
      <Link href="/login" className="text-muted hover:text-foreground">
        Login
      </Link>
      <Link href="/register" className="text-muted hover:text-foreground">
        Register
      </Link>
    </div>
  );
}
