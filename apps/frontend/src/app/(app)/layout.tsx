// ============================================================
// LEGALIR — Authenticated App Layout (Route Group)
// ============================================================

import type { Metadata } from "next";
import { AppLayout } from "@/components/app";
import { NOINDEX_ROBOTS } from "@/lib/site";

// The entire authenticated consumer app (dashboard, chat, documents,
// subscription, profile, …) is private — never indexable.
export const metadata: Metadata = { ...NOINDEX_ROBOTS };

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
