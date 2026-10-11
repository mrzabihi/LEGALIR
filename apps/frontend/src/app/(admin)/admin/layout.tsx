// ============================================================
// LEGALIR — Admin panel layout (dedicated route group)
// ============================================================
// The admin panel lives in its own route group so it gets its own chrome
// (the AdminShell sidebar) instead of the consumer app shell. Pages under
// /admin/** render inside <AdminShell>. Staff gating happens inside the
// shell (UX) and on every API (authorization).
// ============================================================

import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { NOINDEX_ROBOTS } from "@/lib/site";

// The operator console is private and must never appear in search results.
export const metadata: Metadata = { ...NOINDEX_ROBOTS };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
