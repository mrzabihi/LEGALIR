// ============================================================
// LEGALIR — Next.js instrumentation hook
// ============================================================
// `register()` runs once when the server process boots. It is the
// project's real background-job entry point: the periodic history
// retention sweep is started here so the 100-item / 31-day rule is
// enforced by the server, not only by the UI.
// ============================================================

export async function register(): Promise<void> {
  // Only the Node.js runtime can touch the JSON store on disk.
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  const { startHistoryRetentionJob } = await import("./src/lib/history/retention-job");
  startHistoryRetentionJob();

  // Ensure the admin panel is reachable in development. This is a no-op
  // outside NODE_ENV=development and a no-op when a super-admin already
  // exists, so it never touches a real operator's data.
  const { ensureDevAdminSeed } = await import("./src/lib/admin/staff-seed");
  ensureDevAdminSeed();
}
