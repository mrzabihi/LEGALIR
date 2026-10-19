// ============================================================
// LEGALIR — Judicial family identity (client-safe)
// ============================================================
// The judicial card is ONE card that starts several document families, so it
// cannot inherit any single service row's name. Its eyebrow, title and
// description are therefore product copy — and they live here, once, so the
// /cases card, the discovery zones and the /judicial launcher can never drift
// apart.
//
// Per-service copy (the declaration, the brief, …) is NOT here: that comes
// from the admin-managed service rows through `useJudicialServices()` /
// `useJudicialCard()`. This module only names the shared family shell.
// ============================================================

import type { JudicialServiceStatus } from "@legalir/types";
import type { StatusTone } from "@/components/shared";

/** The eyebrow above the family title (same string on every surface). */
export const JUDICIAL_FAMILY_EYEBROW_FA = "دادخواست و شکواییه";

/** The family headline shown when no single document type is selected. */
export const JUDICIAL_FAMILY_TITLE_FA = "تنظیم دادخواست و شکواییه تخصصی";

/** The one-sentence family explanation. */
export const JUDICIAL_FAMILY_DESCRIPTION_FA =
  "موضوع را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله آماده کنید.";

/**
 * Configured status → shared badge tone. Keyed by the row's `status` (not the
 * projected `availability`) so the tone reflects what the admin configured.
 */
export const JUDICIAL_STATUS_TONE: Record<JudicialServiceStatus, StatusTone> = {
  available: "success",
  request_only: "info",
  soon: "warning",
  unavailable: "neutral",
};
