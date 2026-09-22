// ============================================================
// LEGALIR — Onboarding Layout (post-registration)
// ============================================================
// A focused, chrome-free surface for the post-registration steps. It is
// deliberately separate from the authenticated app shell: a brand-new
// user should not see the full navigation until onboarding resolves.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth/mobile");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center px-4 py-12">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -top-32 -end-32 w-80 h-80 rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(212,175,55,0.5), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8">
          <img src="/legalir-logo.png" alt="LEGALIR" className="h-24 w-auto mb-3 drop-shadow-lg" />
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-secondary-600/40 to-transparent" />
        </div>

        <div className="animate-fade-in">{children}</div>

        <p className="text-center text-caption text-neutral-400 mt-8">
          سامانه جامع حقوقی لیگالیر
        </p>
      </div>
    </div>
  );
}
