// ============================================================
// LEGALIR — Onboarding segment layout (server component)
// ============================================================
// The parent (onboarding)/layout.tsx is a client component (it guards auth),
// so it cannot export metadata. This pass-through server layout adds the
// `noindex` directive for the /onboarding/** subtree — private post-signup
// steps that must never be indexed.
// ============================================================

import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/site";

export const metadata: Metadata = { ...NOINDEX_ROBOTS };

export default function OnboardingSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
