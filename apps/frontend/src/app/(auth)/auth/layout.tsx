// ============================================================
// LEGALIR — Auth flow segment layout (server component)
// ============================================================
// The parent (auth)/layout.tsx is a client component (it runs an
// authenticated-user redirect), so it CANNOT export metadata. This thin server
// layout carries the `noindex` directive for the whole /auth/** subtree —
// login, OTP, registration and profile-completion are private surfaces that
// must never be indexed. Rendering is a pass-through; chrome stays in the
// parent layout.
// ============================================================

import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/site";

export const metadata: Metadata = { ...NOINDEX_ROBOTS };

export default function AuthSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
