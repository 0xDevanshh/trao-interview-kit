import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function KitsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
