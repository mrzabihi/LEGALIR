// ============================================================
// LEGALIR — The app-wide page column
// ============================================================
// Every in-app surface renders inside this one column. Before it existed,
// pages hand-wrote their own `max-w-*` and drifted apart (1120px on the
// lists, 1152px on calculators/lawyers/dashboard, 1400px in one Suspense
// fallback), so moving between sections re-flowed the whole layout by up
// to 280px. The fix is not "pick a number and copy it" — it is this
// component: width and gutter live in exactly one place.
//
//   • max-width 1120px — wide enough for a 3-up contract/lawyer grid,
//     narrow enough to keep Persian body lines readable.
//   • gutter p-4 / tablet:p-6 — the same breathing room as the shell.
//   • `w-full` + `mx-auto` — centres the column in MAIN and keeps it
//     fluid below the max width.
//
// Purely presentational: callers keep their own headings, sections,
// state branches and business logic untouched.
// ============================================================

import React from "react";

/** The shared page column. Accepts every `div` attribute (`dir`, `id`…). */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mx-auto w-full max-w-[1120px] p-4 tablet:p-6${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
