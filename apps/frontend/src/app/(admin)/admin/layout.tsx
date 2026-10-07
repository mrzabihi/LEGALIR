// ============================================================
// LEGALIR — Admin panel layout (dedicated route group)
// ============================================================
// The admin panel lives in its own route group so it gets its own chrome
// (the AdminShell sidebar) instead of the consumer app shell. Pages under
// /admin/** render inside <AdminShell>. Staff gating happens inside the
// shell (UX) and on every API (authorization).
// ============================================================

import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
