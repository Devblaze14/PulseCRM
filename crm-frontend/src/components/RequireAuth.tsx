import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";

// Login is optional: anyone can use the app as a guest. We only hold rendering
// while the initial session check runs so a real (signed-in) user's identity is
// known before first paint — there is no redirect to /login.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}
