// ============================================================
// LEGALIR — /contracts/my → /contracts (legacy redirect)
// ============================================================
// The contract workspace used to live at `/contracts/my`. The unified
// `/contracts` hub now owns it (as the «قراردادهای فعال» view), so this
// route is kept only as a stable redirect for old bookmarks, deep links
// and the logged-out menu intents.
//
// The redirect runs on the server before any client render, so there is no
// flash and no duplicate data fetch. Every other query param (the workspace
// filters `?tab=`/`?q=`/…, the discovery filters) is preserved; `view` is
// pinned to the active workspace unless the caller already chose one.

import { redirect } from "next/navigation";

interface MyContractsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MyContractsPage({ searchParams }: MyContractsPageProps) {
  const raw = await searchParams;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  if (!params.has("view")) params.set("view", "active");

  redirect(`/contracts?${params.toString()}`);
}
