// Auth layout — Login, OTP, Profile completion
// Dark gradient background with centered card
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
    <div className="relative min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center px-4 py-12">
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />
      {/* Gold accent glow top-right */}
      <div
        className="absolute -top-32 -end-32 w-80 h-80 rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(212,175,55,0.5), transparent 70%)" }}
        aria-hidden="true"
      />

      {/* The track-selection page lays out three cards side by side, so it
          needs a wider column than the single-column login/OTP forms. */}
      <div
        className={`relative z-10 w-full ${
          pathname === "/auth/register" ? "max-w-4xl" : "max-w-md"
        }`}
      >
        {/* Logo area */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/legalir-logo.png"
            alt="LEGALIR"
            className="h-28 w-auto mb-3 drop-shadow-lg"
          />
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-secondary-600/40 to-transparent" />
        </div>

        {/* Card container — children render inside */}
        <div className="animate-fade-in">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-caption text-neutral-400 mt-8">
          سامانه جامع حقوقی لیگالیر
        </p>
      </div>
    </div>
  );
}
