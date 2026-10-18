// ============================================================
// LEGALIR — /cases service card projection (server-only)
// ============================================================
// One request answers everything the entry card needs: the admin-managed
// settings, the caller's EFFECTIVE availability (config status AND feature
// flag AND the declared requirement) and the caller's own open drafting work.
//
// The card must never invent its own availability: when this function cannot
// confirm the service is enterable, the card renders its unavailable state —
// it does not show a CTA that leads to a route which will refuse the user.
// ============================================================

import type {
  JudicialCapabilities,
  JudicialRequest,
  JudicialRequestSummary,
  JudicialServiceConfig,
  JudicialServiceSummary,
  JudicialServiceView,
} from "@legalir/types";
import { readAiProviderConfig } from "@/lib/ai/provider";
import { JUDICIAL_STATUS_FA } from "@legalir/types";
import type { FlagContext } from "@/lib/admin/flags";
import { JUDICIAL_FLAG_KEY, listJudicialServiceViews } from "./service-config";
import { listRequestsForUser, requestCounts } from "./db";
import { isOpenStatus } from "./workflow";

/** The config row the /cases entry point presents (the petition family). */
export const CASES_CARD_SERVICE_ID = "judicial_petition" as const;

function summarize(request: JudicialRequest): JudicialRequestSummary {
  const counts = requestCounts(request.userId, request.id);
  return {
    id: request.id,
    serviceId: request.serviceId,
    documentType: request.documentType,
    status: request.status,
    currentStep: request.currentStep,
    titleFa: request.titleFa,
    updatedAt: request.updatedAt,
    documentCount: counts.documentCount,
    draftCount: counts.draftCount,
    latestDraftVersion: counts.latestDraftVersion,
    hasApprovedDraft: counts.hasApprovedDraft,
  };
}

function availabilityOf(view: JudicialServiceView): JudicialServiceSummary["availability"] {
  return {
    visible: view.surfaces.cases,
    enabled: view.availability === "available",
    statusLabelFa: JUDICIAL_STATUS_FA[view.availability],
    noteFa: view.availabilityNoteFa,
  };
}

/**
 * The card payload for one caller. `ctx` carries the flag context already
 * resolved by the route (plan code / org / bucket).
 */
export function getJudicialCardSummary(
  userId: string,
  ctx?: Partial<FlagContext>
): JudicialServiceSummary {
  const views = listJudicialServiceViews(ctx);
  const view = views.find((v) => v.id === CASES_CARD_SERVICE_ID) ?? views[0]!;
  const settings: JudicialServiceConfig = view;

  const mine = listRequestsForUser(userId);
  const open = mine.filter((r) => isOpenStatus(r.status) && r.archivedAt === null);

  return {
    settings,
    availability: availabilityOf(view),
    openCount: open.length,
    latest: open[0] ? summarize(open[0]) : null,
  };
}

/**
 * The honest capability report. `canFileJudicially` is the literal `false`:
 * there is no authorized judicial-submission integration in this deployment.
 */
export function getJudicialCapabilities(ctx?: Partial<FlagContext>): JudicialCapabilities {
  const view = listJudicialServiceViews(ctx).find((v) => v.id === CASES_CARD_SERVICE_ID);
  const provider = readAiProviderConfig();
  return {
    canDraft: view?.availability === "available",
    canFileJudicially: false,
    filingNoteFa:
      "لیگالیر هیچ سندی را برای شما ثبت، ارسال یا ابلاغ نمی‌کند. پیش‌نویس فقط برای بازبینی و تکمیل خودتان و وکیل است.",
    providerConfigured: provider.provider === "openai-compatible" && Boolean(provider.apiKey),
    providerName: provider.provider,
    legalSourcesAvailable: true,
  };
}

/** The flag key this feature is gated by (exposed for the admin surface). */
export const JUDICIAL_CARD_FLAG_KEY = JUDICIAL_FLAG_KEY[CASES_CARD_SERVICE_ID];
