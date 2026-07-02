import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/Skeleton";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading Bonado"
        className="motion-page mx-auto flex min-h-dvh max-w-[430px] flex-col gap-4 bg-bg px-6 pt-8"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="size-10" />
        </div>
        <Skeleton className="mt-5 h-3 w-24" />
        <Skeleton className="h-[280px] w-full rounded-[22px]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
