// Auth layout — Login, OTP, Profile completion
// Centered, minimal design
// Authenticated users are redirected to dashboard.

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Redirect authenticated users away from auth pages (except /auth/profile)
  useEffect(() => {
    if (isAuthenticated() && pathname !== "/auth/profile") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, pathname, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-large bg-primary items-center justify-center text-white font-bold text-h1 mb-4">
            ل
          </div>
          <h1 className="text-h2 text-primary">LEGALIR</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
