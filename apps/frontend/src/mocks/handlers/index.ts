// ============================================================
// LEGALIR — MSW Handler Registry (Phase 4 Enhanced)
// ============================================================
// Auth handlers now include in-memory challenge tracking,
// session management via cookies, and comprehensive error
// scenarios for testing all OTP edge cases.
// ============================================================

import { http, HttpResponse, delay } from "msw";
import type { ApiSuccess, ApiError, OtpChallenge, OtpResult } from "@legalir/types";
import { detectPreviewKind } from "@/lib/document-preview";
import {
  fixtureUserPro,
  fixtureUserNew,
  fixtureProfileComplete,
  fixtureProfileIncomplete,
  fixtureDashboard,
  fixtureDashboardEmpty,
  fixtureUsageSummary,
  fixturePlans,
  fixtureEntitlements,
  fixtureConversationRent,
  fixtureDocumentLease,
  fixtureRiskReport,
  fixtureContractNda,
  fixturePreferences,
  fixtureV1SubscriptionGold,
  fixtureV1EntitlementsResponse,
  fixtureV1UsageResponse,
  createCheckoutIntent,
  fixtureAllConversations,
  fixtureV1References,
  fixtureV1SourceCivil490,
  fixtureV1SourceMojer,
  fixtureV1SourceRegulation,
  fixtureV1SourcePrecedent,
  fixtureV1SourceOutdated,
  fixtureV1SourceVersions,
  fixtureV1DocumentCitations,
  createAiRunFixture,
  fixtureDocumentListItems,
  fixtureDocumentDetail,
  fixtureDocumentDetailFailed,
  fixtureRiskReportFull,
  // Phase 10
  fixtureV1ContractTypes,
  fixtureV1QuestionLists,
  fixtureV1ContractListItems,
  fixtureV1ContractDetail,
  fixtureV1ContractAttachmentsNda,
  fixtureV1ContractDetailEmployment,
  fixtureV1ContractDetailPartnership,
  fixtureV1ContractDetailSaas,
  fixtureV1ContractDetailContracting,
  fixtureV1ContractRiskAnalysis,
  fixtureV1GenerateResponse,
  fixtureV1ContractVersion1,
  fixtureV1ContractVersion2,
  // Phase 11
  fixtureV1HistoryItems,
  fixtureV1MemoryItems,
  fixtureV1SubscriptionHistory,
  fixtureProfileUsage,
  fixtureConversationContractReview,
  fixtureV1ConversationDetailContractReview,
  fixtureContractReviewReferences,
  fixtureV1SourceCivil230,
  fixtureV1SourceProcedure522,
  fixtureV1SourceUnity805,
  // Legal Library
  fixtureLegalLibraryListItems,
  fixtureLegalLibraryTopics,
  fixtureLegalSourceDetails,
  fixtureBlogListItems,
  fixtureBlogPostDetails,
  fixtureNotifications,
} from "@legalir/testing";

// --- Constants ---

const API_BASE = "http://localhost:8000";

/** Development OTP — never logged, never returned to client, never shown in error messages */
const DEV_OTP = "405405";

const CHALLENGE_TTL_MS = 120_000; // 2 minutes
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 300_000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3;

// --- In-Memory State ---

interface StoredChallenge {
  challengeId: string;
  mobile: string;
  code: string;
  expiresAt: number; // Date.now() + CHALLENGE_TTL_MS
  attempts: number;
  used: boolean;
  createdAt: number;
}

const challengeStore = new Map<string, StoredChallenge>();
const rateLimitStore = new Map<string, number[]>();
const checkoutIntentStore = new Map<string, { planCode: string; status: string; amount: number; createdAt: number }>();

// --- Phase 10: Draft Store ---

const draftStore = new Map<string, { typeId: string; currentStep: number; answers: Record<string, string>; savedAt: string | null }>();

// --- Phase 7 & 8: Conversation & AI Run State ---

interface StoredMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: string;
  sections?: { id: string; title: string; content: string; order: number }[];
  riskLevel?: string | null;
  createdAt: string;
}

interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  status: string;
  riskLevel: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

const conversationStore = new Map<string, StoredConversation>();
const aiRunStore = new Map<string, { id: string; conversationId: string; messageId: string; modelRef: string; promptVersion: string; status: string; startedAt: string; completedAt: string | null; cancelRequested: boolean }>();

// Seed the store with existing conversations from fixtures
function seedConversations(): void {
  if (conversationStore.size > 0) return;
  const allConvs = [...fixtureAllConversations.slice(0, 5), fixtureConversationContractReview];
  for (const conv of allConvs) {
    conversationStore.set(conv.id, {
      ...conv,
      category: conv.category ?? null,
      messages: [],
    });
  }
}

// --- Envelope Helpers ---

function ok<T>(data: T, meta?: ApiSuccess<T>["meta"]): ApiSuccess<T> {
  return {
    data,
    meta: meta ?? { requestId: crypto.randomUUID() },
  };
}

function err(code: string, message: string, retryable = false): ApiError {
  return {
    code,
    message,
    fieldErrors: [],
    correlationId: crypto.randomUUID(),
    retryable,
  };
}

// --- Clean Up Expired Data ---

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, challenge] of challengeStore) {
    if (challenge.expiresAt < now) {
      challengeStore.delete(id);
    }
  }
}

// ============================================================
// HANDLERS
// ============================================================

export const handlers = [
  // =========================================
  // AUTH — Request OTP
  // =========================================

  http.post(`${API_BASE}/api/auth/otp/request`, async ({ request }) => {
    cleanupExpired();
    await delay(800);

    const body = (await request.json()) as { mobile: string };

    // Validate mobile format
    if (!body.mobile || !/^09\d{9}$/.test(body.mobile)) {
      return HttpResponse.json(
        err("INVALID_MOBILE", "شماره موبایل معتبر نیست", false),
        { status: 400 }
      );
    }

    // --- Rate Limit Check ---
    const timestamps = rateLimitStore.get(body.mobile) ?? [];
    const recentWindow = timestamps.filter((t) => Date.now() - t < RATE_LIMIT_WINDOW_MS);
    rateLimitStore.set(body.mobile, recentWindow);

    // Scenario: 09111111111 is always rate-limited
    if (body.mobile === "09111111111" || recentWindow.length >= MAX_REQUESTS_PER_WINDOW) {
      return HttpResponse.json(
        err("RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است", true),
        { status: 429 }
      );
    }

    // Track request
    recentWindow.push(Date.now());
    rateLimitStore.set(body.mobile, recentWindow);

    // --- Create Challenge ---
    const challengeId = crypto.randomUUID();
    const expiresAt = body.mobile === "09333333333"
      ? Date.now() + 1_000  // Scenario: test expired OTP (1s TTL)
      : Date.now() + CHALLENGE_TTL_MS;

    const challenge: StoredChallenge = {
      challengeId,
      mobile: body.mobile,
      code: DEV_OTP,
      expiresAt,
      attempts: 0,
      used: false,
      createdAt: Date.now(),
    };
    challengeStore.set(challengeId, challenge);

    const response: OtpChallenge = {
      challengeId: challenge.challengeId,
      expiresAt: new Date(expiresAt).toISOString(),
      remainingAttempts: MAX_ATTEMPTS - challenge.attempts,
      resendCooldownSeconds: RESEND_COOLDOWN_SEC,
    };

    return HttpResponse.json(ok(response));
  }),

  // =========================================
  // AUTH — Verify OTP
  // =========================================

  http.post(`${API_BASE}/api/auth/otp/verify`, async ({ request }) => {
    await delay(600);

    const body = (await request.json()) as { challengeId: string; code: string };

    if (!body.challengeId || !body.code) {
      return HttpResponse.json(
        err("VALIDATION_ERROR", "اطلاعات ناقص است", false),
        { status: 400 }
      );
    }

    const stored = challengeStore.get(body.challengeId);

    // Challenge not found
    if (!stored) {
      return HttpResponse.json(
        err("OTP_EXPIRED", "کد تأیید منقضی شده یا معتبر نیست", false),
        { status: 400 }
      );
    }

    // Expired
    if (Date.now() > stored.expiresAt) {
      challengeStore.delete(body.challengeId);
      return HttpResponse.json(
        err("OTP_EXPIRED", "زمان کد به پایان رسیده است", false),
        { status: 400 }
      );
    }

    // Already used
    if (stored.used) {
      return HttpResponse.json(
        err("OTP_REUSED", "این کد قبلاً استفاده شده است", false),
        { status: 400 }
      );
    }

    // Too many attempts
    if (stored.attempts >= MAX_ATTEMPTS) {
      challengeStore.delete(body.challengeId);
      return HttpResponse.json(
        err("TOO_MANY_ATTEMPTS", "تعداد تلاش بیش از حد مجاز", true),
        { status: 429 }
      );
    }

    // Track attempt
    stored.attempts += 1;
    challengeStore.set(body.challengeId, stored);

    // --- Verify Code ---

    // Scenario: 09222222222 always returns invalid OTP
    const isAlwaysInvalid = stored.mobile === "09222222222";

    if (body.code !== stored.code || isAlwaysInvalid) {
      if (stored.attempts >= MAX_ATTEMPTS) {
        challengeStore.delete(body.challengeId);
        return HttpResponse.json(
          err("TOO_MANY_ATTEMPTS", "تعداد تلاش بیش از حد مجاز", true),
          { status: 429 }
        );
      }
      return HttpResponse.json(
        err("OTP_INVALID", "کد واردشده صحیح نیست", false),
        { status: 400 }
      );
    }

    // --- Success ---
    stored.used = true;
    challengeStore.set(body.challengeId, stored);

    const isNewUser = stored.mobile === "09120000000";
    const user = isNewUser ? fixtureUserNew : fixtureUserPro;
    const sessionId = crypto.randomUUID();

    const result: OtpResult = {
      sessionId,
      user,
      isNewUser,
    };

    // Set session cookie in response
    return HttpResponse.json(ok(result), {
      headers: {
        "Set-Cookie": `legalir-session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      },
    });
  }),

  // =========================================
  // AUTH — Logout
  // =========================================

  http.post(`${API_BASE}/api/auth/logout`, async () => {
    await delay(200);
    return HttpResponse.json(ok(null), {
      headers: {
        "Set-Cookie": "legalir-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      },
    });
  }),

  // =========================================
  // USER / PROFILE — GET /api/me
  // =========================================

  http.get(`${API_BASE}/api/me`, async ({ cookies }) => {
    await delay(300);

    const sessionCookie = cookies["legalir-session"];
    if (!sessionCookie) {
      return HttpResponse.json(
        err("UNAUTHORIZED", "نیاز به ورود مجدد", false),
        { status: 401 }
      );
    }

    return HttpResponse.json(
      ok({
        user: fixtureUserPro,
        profile: fixtureProfileComplete,
        preferences: {
          theme: "light",
          locale: "fa-IR",
          notifications: {
            appointments: true,
            contractExpiry: true,
            lawyerResponse: true,
            paymentStatus: true,
            caseUpdate: true,
            marketing: false,
          },
        },
      })
    );
  }),

  // =========================================
  // USER / PROFILE — PATCH /api/me
  // =========================================

  http.patch(`${API_BASE}/api/me`, async ({ request }) => {
    await delay(400);
    const body = await request.json();
    return HttpResponse.json(ok({ ...fixtureProfileComplete, ...(body as object) }));
  }),

  // =========================================
  // DASHBOARD
  // =========================================

  http.get(`${API_BASE}/api/dashboard`, async () => {
    await delay(500);
    return HttpResponse.json(ok(fixtureDashboard));
  }),

  // =========================================
  // PLANS
  // =========================================

  http.get(`${API_BASE}/api/plans`, async () => {
    await delay(300);
    return HttpResponse.json(ok(fixturePlans));
  }),

  // =========================================
  // SUBSCRIPTIONS
  // =========================================

  http.post(`${API_BASE}/api/subscriptions/purchase`, async ({ request }) => {
    await delay(1200);
    const body = (await request.json()) as { planCode: string };
    const plan = fixturePlans.find((p) => p.code === body.planCode);

    if (!plan) {
      return HttpResponse.json(err("INVALID_PLAN", "پلن انتخاب‌شده معتبر نیست", false), { status: 400 });
    }

    return HttpResponse.json(
      ok({
        id: crypto.randomUUID(),
        userId: fixtureUserPro.id,
        planId: plan.id,
        planCode: plan.code,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + plan.durationDays * 86_400_000).toISOString(),
        status: "active",
      })
    );
  }),

  http.get(`${API_BASE}/api/entitlements`, async () => {
    await delay(300);
    return HttpResponse.json(ok(fixtureEntitlements));
  }),

  // =========================================
  // CONVERSATIONS
  // =========================================

  http.get(`${API_BASE}/api/conversations`, async () => {
    await delay(400);
    return HttpResponse.json(
      ok(
        [fixtureConversationRent],
        { requestId: crypto.randomUUID(), pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }
      )
    );
  }),

  http.post(`${API_BASE}/api/conversations`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as { title: string; category?: string };
    return HttpResponse.json(
      ok({
        id: crypto.randomUUID(),
        userId: fixtureUserPro.id,
        title: body.title,
        category: body.category ?? null,
        status: "active",
        riskLevel: null,
        messageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  http.get(`${API_BASE}/api/conversations/:id`, async ({ params }) => {
    await delay(400);
    if (params["id"] === "conv-rent-001") {
      return HttpResponse.json(ok(fixtureConversationRent));
    }
    return HttpResponse.json(err("NOT_FOUND", "گفتگو یافت نشد", false), { status: 404 });
  }),

  http.post(`${API_BASE}/api/conversations/:id/messages`, async ({ params, request }) => {
    await delay(1000);
    const body = (await request.json()) as { content: string };

    return HttpResponse.json(
      ok({
        id: crypto.randomUUID(),
        conversationId: params["id"] as string,
        role: "assistant",
        content: `پاسخ تحلیلی به: "${body.content}"\n\nاین یک پاسخ شبیه‌سازی‌شده است که با خروجی واقعی AI جایگزین می‌شود.`,
        status: "completed",
        createdAt: new Date().toISOString(),
      })
    );
  }),

  // =========================================
  // DOCUMENTS
  // =========================================

  http.get(`${API_BASE}/api/documents`, async () => {
    await delay(300);
    return HttpResponse.json(ok([fixtureDocumentLease]));
  }),

  http.post(`${API_BASE}/api/documents`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { name: string; mime: string; sizeBytes: number };
    return HttpResponse.json(
      ok({
        id: crypto.randomUUID(),
        userId: fixtureUserPro.id,
        name: body.name,
        mime: body.mime,
        sizeBytes: body.sizeBytes,
        status: "uploaded",
        storageKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  http.get(`${API_BASE}/api/documents/:id`, async ({ params }) => {
    await delay(400);
    if (params["id"] === "doc-lease-001") {
      return HttpResponse.json(
        ok({
          ...fixtureDocumentLease,
          jobs: [
            { id: "job-001", documentId: "doc-lease-001", stage: "uploaded", status: "completed", progress: 100, errorCode: null },
            { id: "job-002", documentId: "doc-lease-001", stage: "processing", status: "completed", progress: 100, errorCode: null },
            { id: "job-003", documentId: "doc-lease-001", stage: "extracting", status: "completed", progress: 100, errorCode: null },
            { id: "job-004", documentId: "doc-lease-001", stage: "analyzing", status: "completed", progress: 100, errorCode: null },
          ],
          report: fixtureRiskReport,
        })
      );
    }
    return HttpResponse.json(err("NOT_FOUND", "سند یافت نشد", false), { status: 404 });
  }),

  // =========================================
  // CONTRACTS
  // =========================================

  http.get(`${API_BASE}/api/contracts`, async () => {
    await delay(300);
    return HttpResponse.json(ok([fixtureContractNda]));
  }),

  http.post(`${API_BASE}/api/contracts`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as { type: string };
    return HttpResponse.json(
      ok({
        id: crypto.randomUUID(),
        userId: fixtureUserPro.id,
        type: body.type,
        status: "draft",
        currentVersionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  http.get(`${API_BASE}/api/contracts/:id`, async ({ params }) => {
    await delay(400);
    if (params["id"] === "cnt-nda-001") {
      return HttpResponse.json(ok(fixtureContractNda));
    }
    return HttpResponse.json(err("NOT_FOUND", "قرارداد یافت نشد", false), { status: 404 });
  }),

  // =========================================
  // V1 API — Phase 5 Endpoints
  // =========================================

  // --- GET /api/v1/me ---
  http.get(`${API_BASE}/api/v1/me`, async ({ cookies, request }) => {
    await delay(300);

    const sessionCookie = cookies["legalir-session"];
    if (!sessionCookie) {
      return HttpResponse.json(
        err("UNAUTHORIZED", "نیاز به ورود مجدد", false),
        { status: 401 }
      );
    }

    // Scenario: ?empty=true returns a new user for testing empty states
    const url = new URL(request.url);
    const isNewUser = url.searchParams.get("empty") === "true";

    return HttpResponse.json(
      ok({
        user: isNewUser ? fixtureUserNew : fixtureUserPro,
        profile: isNewUser ? fixtureProfileIncomplete : fixtureProfileComplete,
        preferences: fixturePreferences,
        role: "user",
      })
    );
  }),

  // --- PATCH /api/v1/me/profile ---
  http.patch(`${API_BASE}/api/v1/me/profile`, async ({ request }) => {
    await delay(400);
    const body = await request.json();
    return HttpResponse.json(ok({ ...fixtureProfileComplete, ...(body as object) }));
  }),

  // --- GET /api/v1/dashboard/summary ---
  http.get(`${API_BASE}/api/v1/dashboard/summary`, async ({ request }) => {
    await delay(500);

    // Scenario: ?empty=true returns empty dashboard for new users
    const url = new URL(request.url);
    const isNewUser = url.searchParams.get("empty") === "true";

    return HttpResponse.json(ok(isNewUser ? fixtureDashboardEmpty : fixtureDashboard));
  }),

  // --- GET /api/v1/usage/summary ---
  http.get(`${API_BASE}/api/v1/usage/summary`, async () => {
    await delay(400);

    return HttpResponse.json(ok(fixtureUsageSummary));
  }),

  // --- GET /api/v1/activities/recent ---
  http.get(`${API_BASE}/api/v1/activities/recent`, async ({ request }) => {
    await delay(400);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10);

    const allItems = fixtureDashboard.recentActivity;
    const total = allItems.length;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    return HttpResponse.json(
      ok(
        { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
      )
    );
  }),

  // =========================================
  // V1 API — Phase 6 Endpoints
  // =========================================

  // --- GET /api/v1/plans ---
  http.get(`${API_BASE}/api/v1/plans`, async () => {
    await delay(300);
    return HttpResponse.json(ok(fixturePlans));
  }),

  // --- GET /api/v1/subscriptions/current ---
  http.get(`${API_BASE}/api/v1/subscriptions/current`, async ({ cookies, request }) => {
    await delay(300);

    const sessionCookie = cookies["legalir-session"];
    if (!sessionCookie) {
      return HttpResponse.json(
        err("UNAUTHORIZED", "نیاز به ورود مجدد", false),
        { status: 401 }
      );
    }

    // Scenario: ?status=expired returns an expired subscription
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");

    if (statusParam === "expired") {
      return HttpResponse.json(
        ok({
          ...fixtureV1SubscriptionGold,
          id: "sub-expired-001",
          planCode: "silver",
          planNameFa: "نقره",
          status: "expired",
          startAt: "2026-06-01T00:00:00Z",
          endAt: "2026-07-01T00:00:00Z",
          autoRenew: false,
        })
      );
    }

    // Scenario: ?status=none returns no subscription
    if (statusParam === "none") {
      return HttpResponse.json(ok(null));
    }

    return HttpResponse.json(ok(fixtureV1SubscriptionGold));
  }),

  // --- GET /api/v1/entitlements ---
  http.get(`${API_BASE}/api/v1/entitlements`, async ({ request }) => {
    await delay(300);

    // Scenario: ?plan=ultra returns ultra plan entitlements
    const url = new URL(request.url);
    const planParam = url.searchParams.get("plan");

    if (planParam === "silver") {
      return HttpResponse.json(
        ok({
          entitlements: [
            { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", limit: 150, period: "month" as const, used: 65, isBoolean: false, isEnabled: true },
            { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", limit: 3, period: "month" as const, used: 2, isBoolean: false, isEnabled: true },
            { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", limit: 2, period: "month" as const, used: 0, isBoolean: false, isEnabled: true },
            { featureKey: "ADVANCED_REFERENCE", nameFa: "منابع پیشرفته", limit: null, period: "forever" as const, used: 0, isBoolean: true, isEnabled: false },
            { featureKey: "PRIORITY_PROCESSING", nameFa: "اولویت پردازش", limit: null, period: "forever" as const, used: 0, isBoolean: true, isEnabled: false },
          ],
          planCode: "silver" as const,
          planNameFa: "نقره",
        })
      );
    }

    return HttpResponse.json(ok(fixtureV1EntitlementsResponse));
  }),

  // --- GET /api/v1/usage ---
  http.get(`${API_BASE}/api/v1/usage`, async () => {
    await delay(400);
    return HttpResponse.json(ok(fixtureV1UsageResponse));
  }),

  // --- POST /api/v1/checkout/intents ---
  http.post(`${API_BASE}/api/v1/checkout/intents`, async ({ request }) => {
    await delay(800);

    const body = (await request.json()) as { planCode: string };
    const plan = fixturePlans.find((p) => p.code === body.planCode);

    if (!plan) {
      return HttpResponse.json(
        err("INVALID_PLAN", "پلن انتخاب‌شده معتبر نیست", false),
        { status: 400 }
      );
    }

    const intent = createCheckoutIntent(plan.code, "creating");
    // Override status to "creating" then "pending" after a simulated gateway call
    intent.status = "pending";
    intent.paymentUrl = "https://mock-payment.legalir.ir/pay?id=mock-123";

    checkoutIntentStore.set(intent.id, {
      planCode: plan.code,
      status: "pending",
      amount: plan.salePrice,
      createdAt: Date.now(),
    });

    return HttpResponse.json(ok(intent), { status: 201 });
  }),

  // --- GET /api/v1/checkout/intents/:id ---
  http.get(`${API_BASE}/api/v1/checkout/intents/:id`, async ({ params }) => {
    await delay(300);

    const intentId = params["id"] as string;
    const stored = checkoutIntentStore.get(intentId);

    if (!stored) {
      return HttpResponse.json(
        err("NOT_FOUND", "درخواست پرداخت یافت نشد", false),
        { status: 404 }
      );
    }

    // Scenario: URL query ?result=paid|failed|cancelled simulates payment outcome
    // If status was "pending" and we receive a request, we simulate successful payment
    let finalStatus = stored.status;
    if (finalStatus === "pending") {
      finalStatus = "paid";
      checkoutIntentStore.set(intentId, { ...stored, status: finalStatus });
    }

    const plan = fixturePlans.find((p) => p.code === stored.planCode) ?? fixturePlans[0];
    if (!plan) return HttpResponse.json(err("NOT_FOUND", "", false), { status: 500 });

    const intent: ReturnType<typeof createCheckoutIntent> = {
      id: intentId,
      planCode: stored.planCode as typeof plan.code,
      amount: stored.amount,
      currency: "IRT",
      status: finalStatus as "paid" | "failed" | "cancelled" | "pending" | "creating" | "idle",
      paymentUrl: finalStatus === "pending" ? "https://mock-payment.legalir.ir/pay?id=mock-123" : null,
      createdAt: new Date(stored.createdAt).toISOString(),
      expiresAt: new Date(stored.createdAt + 30 * 60_000).toISOString(),
      metadata: {
        planNameFa: plan.nameFa,
        durationDays: plan.durationDays,
        dailyRequests: plan.dailyRequestLimit,
        totalTokens: plan.totalTokenLimit,
      },
    };

    return HttpResponse.json(ok(intent));
  }),

  // =========================================
  // V1 API — Phase 7: Conversation Endpoints
  // =========================================

  // --- GET /api/v1/conversations ---
  http.get(`${API_BASE}/api/v1/conversations`, async ({ request }) => {
    await delay(400);
    seedConversations();

    const url = new URL(request.url);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

    // Scenario: ?empty=true returns empty list
    if (url.searchParams.get("empty") === "true") {
      return HttpResponse.json(
        ok([], { requestId: crypto.randomUUID(), pagination: { page: 1, pageSize, total: 0, totalPages: 0 } })
      );
    }

    const allConvs = Array.from(conversationStore.values()).map(
      ({ messages: _m, ...rest }) => rest
    );
    allConvs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return HttpResponse.json(
      ok(allConvs, {
        requestId: crypto.randomUUID(),
        pagination: { page: 1, pageSize, total: allConvs.length, totalPages: 1 },
      })
    );
  }),

  // --- POST /api/v1/conversations ---
  http.post(`${API_BASE}/api/v1/conversations`, async ({ request }) => {
    await delay(600);
    seedConversations();

    const body = (await request.json()) as { title: string; category?: string };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const conv: StoredConversation = {
      id,
      userId: "u-pro-001",
      title: body.title,
      category: body.category ?? null,
      status: "active",
      riskLevel: null,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    conversationStore.set(id, conv);

    const { messages: _m, ...rest } = conv;
    return HttpResponse.json(ok(rest), { status: 201 });
  }),

  // --- GET /api/v1/conversations/:id ---
  http.get(`${API_BASE}/api/v1/conversations/:id`, async ({ params, request: _request }) => {
    await delay(400);
    seedConversations();

    const id = params["id"] as string;

    // Scenario: preloaded demo conversation — contract review
    if (id === "conv-contract-review-001") {
      return HttpResponse.json(ok(fixtureV1ConversationDetailContractReview));
    }

    // Scenario: conv-new returns a fresh conversation
    if (id === "conv-new") {
      return HttpResponse.json(
        ok({
          id: "conv-new",
          userId: "u-pro-001",
          title: "گفتگوی جدید",
          category: null,
          status: "active",
          riskLevel: null,
          messageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          aiRuns: [],
          references: [],
        })
      );
    }

    // Scenario: conv-failed returns a conversation with a failed run
    if (id === "conv-failed") {
      return HttpResponse.json(
        ok({
          id: "conv-failed",
          userId: "u-pro-001",
          title: "گفتگوی با خطا",
          category: "contract",
          status: "active",
          riskLevel: "high",
          messageCount: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: "msg-failed-001",
              conversationId: "conv-failed",
              role: "user" as const,
              content: "قرارداد من مشکل دارد",
              status: "sent",
              createdAt: new Date().toISOString(),
            },
            {
              id: "msg-failed-002",
              conversationId: "conv-failed",
              role: "assistant" as const,
              content: "خطا در پردازش",
              status: "failed",
              createdAt: new Date().toISOString(),
            },
          ],
          aiRuns: [
            createAiRunFixture("conv-failed", "msg-failed-002", "failed"),
          ],
          references: [],
        })
      );
    }

    const stored = conversationStore.get(id);
    if (!stored) {
      return HttpResponse.json(err("NOT_FOUND", "گفتگو یافت نشد", false), { status: 404 });
    }

    const messages = stored.messages;
    const aiRuns = Array.from(aiRunStore.values()).filter((r) => r.conversationId === id);

    return HttpResponse.json(
      ok({
        ...stored,
        messages: messages.map((m) => ({
          ...m,
          status: m.status as "draft" | "sending" | "sent" | "streaming" | "validating" | "completed" | "blocked" | "failed",
          sections: m.sections,
          riskLevel: m.riskLevel ?? null,
        })),
        aiRuns,
        references: [],
      })
    );
  }),

  // --- PATCH /api/v1/conversations/:id ---
  http.patch(`${API_BASE}/api/v1/conversations/:id`, async ({ params, request }) => {
    await delay(500);

    const id = params["id"] as string;
    const body = (await request.json()) as { title?: string; status?: string };
    const stored = conversationStore.get(id);

    if (!stored) {
      return HttpResponse.json(err("NOT_FOUND", "گفتگو یافت نشد", false), { status: 404 });
    }

    if (body.title !== undefined) stored.title = body.title;
    if (body.status !== undefined) stored.status = body.status;
    stored.updatedAt = new Date().toISOString();
    conversationStore.set(id, stored);

    const { messages: _m, ...rest } = stored;
    return HttpResponse.json(ok(rest));
  }),

  // --- POST /api/v1/conversations/:id/messages ---
  http.post(`${API_BASE}/api/v1/conversations/:id/messages`, async ({ params, request }) => {
    await delay(400);
    seedConversations();

    const id = params["id"] as string;
    const url = new URL(request.url);
    const body = (await request.json()) as { content: string };
    const stored = conversationStore.get(id);

    if (!stored) {
      return HttpResponse.json(err("NOT_FOUND", "گفتگو یافت نشد", false), { status: 404 });
    }

    // Add user message
    const userMsg: StoredMessage = {
      id: crypto.randomUUID(),
      conversationId: id,
      role: "user",
      content: body.content,
      status: "sent",
      createdAt: new Date().toISOString(),
    };
    stored.messages.push(userMsg);
    stored.messageCount = stored.messages.length;
    stored.updatedAt = new Date().toISOString();
    conversationStore.set(id, stored);

    // Scenario: ?block=true returns blocked
    if (url.searchParams.get("block") === "true") {
      const blockedMsg: StoredMessage = {
        id: crypto.randomUUID(),
        conversationId: id,
        role: "assistant",
        content: "متأسفانه امکان پاسخگویی به این درخواست وجود ندارد. این موضوع خارج از حیطه مشاوره حقوقی ماست.",
        status: "blocked",
        createdAt: new Date().toISOString(),
      };
      stored.messages.push(blockedMsg);
      stored.updatedAt = new Date().toISOString();
      conversationStore.set(id, stored);

      return HttpResponse.json(
        ok({
          ...blockedMsg,
          status: "blocked" as const,
          sections: [],
          riskLevel: null,
          references: [],
        })
      );
    }

    // Scenario: ?fail=true returns failed
    if (url.searchParams.get("fail") === "true") {
      const failedMsg: StoredMessage = {
        id: crypto.randomUUID(),
        conversationId: id,
        role: "assistant",
        content: "خطا در پردازش درخواست",
        status: "failed",
        createdAt: new Date().toISOString(),
      };
      stored.messages.push(failedMsg);
      stored.updatedAt = new Date().toISOString();
      conversationStore.set(id, stored);

      const run = createAiRunFixture(id, failedMsg.id, "failed");
      aiRunStore.set(run.id, { ...run, cancelRequested: false });

      return HttpResponse.json(
        ok({
          ...failedMsg,
          status: "failed" as const,
          sections: [],
          riskLevel: null,
          references: [],
        })
      );
    }

    // Default: Return structured response (simulated streaming-complete)
    await delay(2000);

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: StoredMessage = {
      id: assistantMsgId,
      conversationId: id,
      role: "assistant",
      content: "بر اساس اطلاعات ارائه‌شده، تحلیل حقوقی زیر ارائه می‌شود:",
      status: "completed",
      sections: [
        { id: "sec-summary", title: "خلاصه", content: "بر اساس اطلاعات ارائه‌شده، ورود صاحبخانه بدون اجازه به ملک استیجاری، نقض حقوق مستأجر محسوب می‌شود. قانون روابط موجر و مستأجر مصوب ۱۳۷۶، حقوق مشخصی را برای مستأجر در نظر گرفته است.", order: 1 },
        { id: "sec-facts", title: "اطلاعات و فرض‌ها", content: "اطلاعات ارائه‌شده:\n- درخواست کاربر در مورد موضوع حقوقی مطرح شده\n- اطلاعات اولیه حقوقی از کاربر دریافت شده است\n\nفرض‌ها:\n- قرارداد معتبر و قانونی است\n- اطلاعات ارائه‌شده صحیح است", order: 2 },
        { id: "sec-analysis", title: "تحلیل اولیه", content: "طبق ماده ۴۹۰ قانون مدنی، مستأجر در مدت اجاره مالک منافع ملک است و صاحبخانه حق ورود بدون اجازه را ندارد. همچنین بر اساس قانون روابط موجر و مستأجر مصوب ۱۳۷۶، تصرف عدوانی توسط موجر قابل پیگرد است.", order: 3 },
        { id: "sec-risks", title: "ریسک‌ها", content: "۱. **ریسک بالا**: ادامه اقدامات خلاف قانون می‌تواند به مشکلات جدی حقوقی منجر شود.\n۲. **ریسک متوسط**: احتمال طولانی شدن روند رسیدگی قانونی وجود دارد.\n۳. **ریسک متوسط**: در صورت عدم اقدام قانونی به‌موقع، حق شکایت ممکن است با محدودیت زمانی مواجه شود.", order: 4 },
        { id: "sec-actions", title: "اقدامات پیشنهادی", content: "۱. ارسال اظهارنامه رسمی به طرف مقابل\n۲. مستندسازی تمام موارد با تاریخ و ساعت\n۳. در صورت تکرار، طرح شکایت در مرجع صالح\n۴. مشاوره با وکیل متخصص\n۵. جمع‌آوری مدارک و مستندات مرتبط", order: 5 },
        { id: "sec-sources", title: "منابع", content: "تحلیل فوق بر اساس منابع حقوقی زیر انجام شده است:", order: 6 },
        { id: "sec-disclaimer", title: "هشدار حقوقی", content: "این تحلیل توسط هوش مصنوعی LEGALIR انجام شده و به هیچ‌وجه جایگزین مشاوره با وکیل متخصص نیست. قوانین ممکن است بسته به شرایط خاص پرونده شما تفسیر متفاوتی داشته باشند. توصیه می‌شود پیش از هر اقدام حقوقی با یک وکیل مشورت کنید.", order: 7 },
      ],
      riskLevel: "medium",
      createdAt: new Date().toISOString(),
    };

    stored.messages.push(assistantMsg);
    stored.messageCount = stored.messages.length;
    stored.updatedAt = new Date().toISOString();
    conversationStore.set(id, stored);

    // Create AI run
    const run = createAiRunFixture(id, assistantMsgId, "succeeded");
    aiRunStore.set(run.id, { ...run, cancelRequested: false });

    return HttpResponse.json(
      ok({
        ...assistantMsg,
        status: "completed" as const,
        sections: assistantMsg.sections,
        riskLevel: "medium" as const,
        references: [],
      })
    );
  }),

  // =========================================
  // V1 API — Phase 7: AI Run Endpoints
  // =========================================

  // --- POST /api/v1/ai-runs ---
  http.post(`${API_BASE}/api/v1/ai-runs`, async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { conversationId: string; messageId: string };

    const run = createAiRunFixture(body.conversationId, body.messageId, "queued");
    run.completedAt = null;
    aiRunStore.set(run.id, { ...run, status: "queued", cancelRequested: false });

    return HttpResponse.json(ok(run), { status: 201 });
  }),

  // --- GET /api/v1/ai-runs/:id ---
  http.get(`${API_BASE}/api/v1/ai-runs/:id`, async ({ params }) => {
    await delay(200);

    const id = params["id"] as string;
    const stored = aiRunStore.get(id);

    if (!stored) {
      return HttpResponse.json(err("NOT_FOUND", "پردازش یافت نشد", false), { status: 404 });
    }

    // Auto-progress through states if not terminal
    const statusFlow = ["queued", "retrieving", "generating", "validating", "succeeded"] as const;
    const currentIdx = statusFlow.indexOf(stored.status as typeof statusFlow[number]);

    if (stored.cancelRequested) {
      stored.status = "failed";
      stored.completedAt = new Date().toISOString();
      aiRunStore.set(id, stored);
    } else if (currentIdx >= 0 && currentIdx < statusFlow.length - 1) {
      const nextStatus = statusFlow[currentIdx + 1];
      if (nextStatus) stored.status = nextStatus;
      if (stored.status === "succeeded") {
        stored.completedAt = new Date().toISOString();
      }
      aiRunStore.set(id, stored);
    }

    return HttpResponse.json(
      ok({
        id: stored.id,
        conversationId: stored.conversationId,
        messageId: stored.messageId,
        modelRef: stored.modelRef,
        promptVersion: stored.promptVersion,
        status: stored.status,
        startedAt: stored.startedAt,
        completedAt: stored.completedAt,
      })
    );
  }),

  // --- POST /api/v1/ai-runs/:id/cancel ---
  http.post(`${API_BASE}/api/v1/ai-runs/:id/cancel`, async ({ params }) => {
    await delay(400);

    const id = params["id"] as string;
    const stored = aiRunStore.get(id);

    if (!stored) {
      return HttpResponse.json(err("NOT_FOUND", "پردازش یافت نشد", false), { status: 404 });
    }

    stored.cancelRequested = true;
    stored.status = "failed";
    stored.completedAt = new Date().toISOString();
    aiRunStore.set(id, stored);

    return HttpResponse.json(
      ok({
        id: stored.id,
        conversationId: stored.conversationId,
        messageId: stored.messageId,
        modelRef: stored.modelRef,
        promptVersion: stored.promptVersion,
        status: "failed" as const,
        startedAt: stored.startedAt,
        completedAt: stored.completedAt,
      })
    );
  }),

  // =========================================
  // V1 API — Phase 8: References & Sources
  // =========================================

  // --- GET /api/v1/conversations/:id/references ---
  http.get(`${API_BASE}/api/v1/conversations/:id/references`, async ({ params, request: _request }) => {
    await delay(300);

    const id = params["id"] as string;

    // Scenario: empty conversation
    if (id === "conv-empty") {
      return HttpResponse.json(ok([]));
    }

    // Return references for the demo contract review conversation
    if (id === "conv-contract-review-001") {
      return HttpResponse.json(ok(fixtureContractReviewReferences));
    }

    return HttpResponse.json(ok(fixtureV1References));
  }),

  // --- GET /api/v1/sources/:id ---
  http.get(`${API_BASE}/api/v1/sources/:id`, async ({ params, request }) => {
    await delay(400);

    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: unavailable source
    if (url.searchParams.get("status") === "unavailable" || id === "src-unavailable-001") {
      return HttpResponse.json(err("SOURCE_UNAVAILABLE", "منبع در دسترس نیست", true), { status: 404 });
    }

    // Scenario: access denied
    if (url.searchParams.get("status") === "denied" || id === "src-denied-001") {
      return HttpResponse.json(err("ACCESS_DENIED", "دسترسی به این منبع محدود شده است", false), { status: 403 });
    }

    // Map source IDs
    const sourceMap: Record<string, typeof fixtureV1SourceCivil490> = {
      "src-law-civil-490": fixtureV1SourceCivil490,
      "src-law-mojer-1376": fixtureV1SourceMojer,
      "src-regulation-building": fixtureV1SourceRegulation,
      "src-precinct-1402135": fixtureV1SourcePrecedent,
      "src-outdated-001": fixtureV1SourceOutdated,
      "src-law-civil-230": fixtureV1SourceCivil230,
      "src-law-procedure-522": fixtureV1SourceProcedure522,
      "src-unity-decision-805": fixtureV1SourceUnity805,
    };

    const source = sourceMap[id];
    if (!source) {
      return HttpResponse.json(err("NOT_FOUND", "منبع یافت نشد", false), { status: 404 });
    }

    // Scenario: outdated source
    if (url.searchParams.get("status") === "outdated" || id === "src-outdated-001") {
      return HttpResponse.json(ok({ ...source, status: "expired", availability: "outdated" }));
    }

    return HttpResponse.json(ok(source));
  }),

  // --- GET /api/v1/sources/:id/versions ---
  http.get(`${API_BASE}/api/v1/sources/:id/versions`, async ({ params }) => {
    await delay(300);

    const id = params["id"] as string;

    if (id === "src-law-civil-490") {
      return HttpResponse.json(ok(fixtureV1SourceVersions));
    }

    return HttpResponse.json(ok([]));
  }),

  // --- GET /api/v1/documents/:id/citations ---
  http.get(`${API_BASE}/api/v1/documents/:id/citations`, async ({ params }) => {
    await delay(300);

    const id = params["id"] as string;

    if (id === fixtureV1DocumentCitations.documentId) {
      return HttpResponse.json(ok(fixtureV1DocumentCitations));
    }

    return HttpResponse.json(ok({ documentId: id, citations: [] }));
  }),

  // =========================================
  // V1 API — Phase 9: Document Upload & Analysis
  // =========================================

  // In-memory document state
  // (lazy-init seeded document store)
  // Note: documentStore is typed loosely to avoid import overhead

  // --- GET /api/v1/documents ---
  http.get(`${API_BASE}/api/v1/documents`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "all";
    const sort = url.searchParams.get("sort") ?? "newest";

    let items = [...fixtureDocumentListItems];

    // Scenario: fail with server error
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("INTERNAL_ERROR", "خطای داخلی سرور", true),
        { status: 500 }
      );
    }

    // Apply search filter
    if (search) {
      items = items.filter((d) => d.name.toLowerCase().includes(search));
    }

    // Apply status filter
    if (statusFilter !== "all") {
      items = items.filter((d) => d.status === statusFilter);
    }

    // Apply sort
    if (sort === "oldest") {
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name, "fa"));
    } else {
      // newest
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return HttpResponse.json(
      ok({ items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } })
    );
  }),

  // --- POST /api/v1/documents/uploads ---
  http.post(`${API_BASE}/api/v1/documents/uploads`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as { name: string; mime: string; sizeBytes: number };

    // Validate mime type
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (!allowedMimes.includes(body.mime)) {
      return HttpResponse.json(
        err("UNSUPPORTED_FORMAT", "فرمت فایل پشتیبانی نمی‌شود", false),
        { status: 400 }
      );
    }

    // Validate size
    const MAX_SIZE = 25 * 1024 * 1024;
    if (body.sizeBytes > MAX_SIZE) {
      return HttpResponse.json(
        err("FILE_TOO_LARGE", "حجم فایل بیش از ۲۵ مگابایت است", false),
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    return HttpResponse.json(
      ok({
        id,
        uploadUrl: `http://localhost:8000/api/v1/documents/uploads/${id}/complete`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
      { status: 201 }
    );
  }),

  // --- POST /api/v1/documents/uploads/:id/complete ---
  http.post(`${API_BASE}/api/v1/documents/uploads/:id/complete`, async ({ params, request }) => {
    await delay(800);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: simulate failure
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("UPLOAD_FAILED", "خطا در تکمیل بارگذاری", true),
        { status: 500 }
      );
    }

    return HttpResponse.json(
      ok({
        id,
        name: "سند-جدید.pdf",
        mime: "application/pdf",
        sizeBytes: 450_000,
        status: "processing",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        riskLevel: null,
        findingCount: 0,
      })
    );
  }),

  // --- GET /api/v1/documents/:id/status ---
  http.get(`${API_BASE}/api/v1/documents/:id/status`, async ({ params, request }) => {
    await delay(300);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: poll for specific state transitions
    const stageParam = url.searchParams.get("stage");
    const failParam = url.searchParams.get("fail");

    if (failParam === "true" || id === "doc-failed-001") {
      return HttpResponse.json(
        ok({
          id,
          status: "failed",
          progress: 45,
          currentStage: "extracting",
          errorCode: "OCR_LOW_QUALITY",
        })
      );
    }

    // Known document IDs from fixtures
    if (id === "doc-lease-001" || id === "doc-employment-002" || id === "doc-contract-001") {
      return HttpResponse.json(
        ok({ id, status: "ready", progress: 100, currentStage: null, errorCode: null })
      );
    }

    if (id === "doc-nda-001" || stageParam === "processing") {
      return HttpResponse.json(
        ok({ id, status: "processing", progress: 35, currentStage: "extracting", errorCode: null })
      );
    }

    // Default: simulate processing for unknown IDs
    return HttpResponse.json(
      ok({ id, status: "uploaded", progress: 10, currentStage: "processing", errorCode: null })
    );
  }),

  // --- GET /api/v1/documents/:id/analysis ---
  http.get(`${API_BASE}/api/v1/documents/:id/analysis`, async ({ params, request }) => {
    await delay(500);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: analysis not ready
    if (url.searchParams.get("notReady") === "true" || id === "doc-nda-001") {
      return HttpResponse.json(
        err("ANALYSIS_NOT_READY", "تحلیل هنوز آماده نیست", true),
        { status: 409 }
      );
    }

    // Scenario: analysis failed
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("ANALYSIS_FAILED", "خطا در تحلیل سند", true),
        { status: 500 }
      );
    }

    // Known document with analysis
    if (id === "doc-lease-001" || id === "doc-contract-001" || id === "doc-employment-002") {
      return HttpResponse.json(
        ok({
          report: fixtureRiskReportFull,
          extractedText:
            "قرارداد اجاره آپارتمان\n\nماده ۱: طرفین قرارداد\nموجر: آقای علی احمدی...\nماده ۲: موضوع قرارداد\nیک باب آپارتمان مسکونی...",
        })
      );
    }

    return HttpResponse.json(err("NOT_FOUND", "سند یافت نشد", false), { status: 404 });
  }),

  // --- GET /api/v1/documents/:id ---
  http.get(`${API_BASE}/api/v1/documents/:id`, async ({ params, request }) => {
    await delay(400);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: document gone
    if (url.searchParams.get("gone") === "true" || id === "doc-deleted-001") {
      return HttpResponse.json(err("GONE", "سند حذف شده است", false), { status: 410 });
    }

    // Map to known document fixtures
    const docMap: Record<string, unknown> = {
      "doc-lease-001": fixtureDocumentDetail,
      "doc-contract-001": {
        ...fixtureDocumentDetail,
        id: "doc-contract-001",
        name: "قرارداد-پیمانکاری-ساختمان.pdf",
        sizeBytes: 820_000,
        createdAt: "2026-07-25T09:00:00Z",
        updatedAt: "2026-07-25T11:30:00Z",
      },
      "doc-nda-001": {
        ...fixtureDocumentDetail,
        id: "doc-nda-001",
        name: "توافقنامه-محرمانگی-شرکتی.docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 245_000,
        status: "processing",
        report: null,
        extractedText: null,
        jobs: [
          { id: "job-201", documentId: "doc-nda-001", stage: "uploaded", status: "completed", progress: 100, errorCode: null },
          { id: "job-202", documentId: "doc-nda-001", stage: "processing", status: "completed", progress: 100, errorCode: null },
          { id: "job-203", documentId: "doc-nda-001", stage: "extracting", status: "running", progress: 35, errorCode: null },
        ],
        createdAt: "2026-07-30T08:00:00Z",
        updatedAt: "2026-07-30T08:05:00Z",
      },
      "doc-failed-001": fixtureDocumentDetailFailed,
      "doc-employment-002": {
        ...fixtureDocumentDetail,
        id: "doc-employment-002",
        name: "قرارداد-استخدام-شرکت-فنی.docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 520_000,
        report: {
          ...fixtureRiskReportFull,
          documentId: "doc-employment-002",
          findings: [fixtureRiskReportFull.findings[0] ?? { id: "", title: "", severity: "low", description: "" }],
          summary: "۱ مورد نیازمند توجه شناسایی شد.",
          confidence: 0.92,
        },
        createdAt: "2026-07-20T10:00:00Z",
        updatedAt: "2026-07-20T12:00:00Z",
      },
    };

    const detail = docMap[id];
    if (!detail) {
      return HttpResponse.json(err("NOT_FOUND", "سند یافت نشد", false), { status: 404 });
    }

    return HttpResponse.json(ok(detail));
  }),

  // --- GET /api/v1/documents/:id/preview ---
  // Mirrors the real route: resolves the preview kind from MIME +
  // extension and returns auth-gated same-origin file URLs.
  http.get(`${API_BASE}/api/v1/documents/:id/preview`, async ({ params }) => {
    await delay(200);
    const id = params["id"] as string;

    const previewMap: Record<string, { name: string; mime: string; sizeBytes: number }> = {
      "doc-lease-001": { name: fixtureDocumentDetail.name, mime: "application/pdf", sizeBytes: fixtureDocumentDetail.sizeBytes },
      "doc-contract-001": { name: "قرارداد-پیمانکاری-ساختمان.pdf", mime: "application/pdf", sizeBytes: 820_000 },
      "doc-nda-001": { name: "توافقنامه-محرمانگی-شرکتی.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 245_000 },
      "doc-failed-001": { name: fixtureDocumentDetailFailed.name, mime: "application/pdf", sizeBytes: fixtureDocumentDetailFailed.sizeBytes },
      "doc-employment-002": { name: "قرارداد-استخدام-شرکت-فنی.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 520_000 },
    };

    const meta = previewMap[id];
    if (!meta) {
      return HttpResponse.json(err("NOT_FOUND", "سند یافت نشد", false), { status: 404 });
    }

    const kind = detectPreviewKind(meta.mime, meta.name);
    const available = kind !== "unsupported";

    return HttpResponse.json(
      ok({
        documentId: id,
        name: meta.name,
        mime: meta.mime,
        sizeBytes: meta.sizeBytes,
        kind,
        fileUrl: available ? `/api/v1/documents/${id}/file` : null,
        downloadUrl: `/api/v1/documents/${id}/download`,
        available,
      })
    );
  }),

  // --- POST /api/v1/documents/:id/retry ---
  http.post(`${API_BASE}/api/v1/documents/:id/retry`, async ({ params, request }) => {
    await delay(1000);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: retry fails again
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("RETRY_FAILED", "تلاش مجدد ناموفق بود", true),
        { status: 500 }
      );
    }

    // Scenario: document not in retryable state
    if (id === "doc-lease-001") {
      return HttpResponse.json(
        err("INVALID_STATE", "سند در وضعیت قابل تلاش مجدد نیست", false),
        { status: 409 }
      );
    }

    return HttpResponse.json(
      ok({ id, status: "processing" })
    );
  }),

  // --- DELETE /api/v1/documents/:id ---
  http.delete(`${API_BASE}/api/v1/documents/:id`, async ({ params: _params, request }) => {
    await delay(500);
    const url = new URL(request.url);

    // Scenario: delete fails
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("DELETE_FAILED", "خطا در حذف سند", true),
        { status: 500 }
      );
    }

    return HttpResponse.json(ok({ deleted: true as const }));
  }),

  // =========================================
  // PHASE 10 — CONTRACT WORKSPACE
  // =========================================

  // --- Contract Types ---
  http.get(`${API_BASE}/api/v1/contract-types`, async () => {
    await delay(300);
    return HttpResponse.json(ok(fixtureV1ContractTypes));
  }),

  // --- Contract Questions ---
  http.get(`${API_BASE}/api/v1/contract-types/:typeId/questions`, async ({ params }) => {
    await delay(300);
    const typeId = params["typeId"] as string;
    const questions = fixtureV1QuestionLists[typeId as keyof typeof fixtureV1QuestionLists];
    if (!questions || questions.length === 0) {
      return HttpResponse.json(
        ok({ typeId, questions: [] })
      );
    }
    return HttpResponse.json(ok({ typeId, questions }));
  }),

  // --- GET /api/v1/contracts (List) ---
  http.get(`${API_BASE}/api/v1/contracts`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);

    // Scenario: fail
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("FETCH_FAILED", "خطا در دریافت لیست قراردادها", true),
        { status: 500 }
      );
    }

    let items = [...fixtureV1ContractListItems];

    // Filter by search
    const search = url.searchParams.get("search");
    if (search) {
      items = items.filter((c) => c.title.includes(search));
    }

    // Filter by state
    const state = url.searchParams.get("state");
    if (state) {
      items = items.filter((c) => c.state === state);
    }

    // Filter by category
    const category = url.searchParams.get("category");
    if (category) {
      items = items.filter((c) => c.category === category);
    }

    // Sort
    const sort = url.searchParams.get("sort");
    if (sort === "oldest") {
      items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else if (sort === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title, "fa"));
    } else {
      // default: newest
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20");

    return HttpResponse.json(
      ok({
        items,
        pagination: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) },
      })
    );
  }),

  // --- POST /api/v1/contracts (Create) ---
  http.post(`${API_BASE}/api/v1/contracts`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as { typeId: string; title: string };
    const url = new URL(request.url);

    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("CREATE_FAILED", "خطا در ایجاد قرارداد", true),
        { status: 500 }
      );
    }

    if (!body.typeId || !body.title) {
      return HttpResponse.json(
        err("VALIDATION_ERROR", "اطلاعات ناقص است", false),
        { status: 400 }
      );
    }

    const id = `cnt-${body.typeId}-${crypto.randomUUID().slice(0, 8)}`;
    return HttpResponse.json(
      ok({
        id,
        typeId: body.typeId,
        title: body.title,
        state: "collecting" as const,
        createdAt: new Date().toISOString(),
      })
    );
  }),

  // --- GET /api/v1/contracts/:id (Detail) ---
  http.get(`${API_BASE}/api/v1/contracts/:id`, async ({ params }) => {
    await delay(400);
    const id = params["id"] as string;

    if (id === "cnt-lease-001") {
      return HttpResponse.json(ok(fixtureV1ContractDetail));
    }
    if (id === "cnt-nda-001") {
      return HttpResponse.json(
        ok({
          ...fixtureV1ContractDetail,
          id: "cnt-nda-001",
          title: "توافقنامه محرمانگی",
          type: "nda" as const,
          typeFa: "NDA",
          category: "business" as const,
          state: "under_review" as const,
          currentVersionId: "ver-nda-001",
          currentVersionNumber: 1,
          versions: [{
            id: "ver-nda-001",
            contractId: "cnt-nda-001",
            versionNumber: 1,
            answers: { party1_name: "شرکت الف", party2_name: "شرکت ب", purpose: "همکاری تجاری", duration_months: "۲۴", penalty_amount: "۵۰۰۰۰۰۰۰۰", governing_law: "iran" },
            content: "توافقنامه عدم افشای اطلاعات محرمانه\n\nاین توافقنامه بین شرکت الف و شرکت ب منعقد می‌گردد...",
            clauses: [
              { id: "cl-n01", title: "ماده ۱ - تعریف اطلاعات محرمانه", content: "اطلاعات محرمانه شامل...", isProtective: false, importance: "essential" as const },
              { id: "cl-n02", title: "ماده ۲ - تعهدات گیرنده", content: "گیرنده متعهد می‌گردد...", isProtective: true, importance: "essential" as const },
            ],
            state: "under_review" as const,
            createdAt: "2026-07-28T09:00:00Z",
          }],
          analysis: null,
          attachments: fixtureV1ContractAttachmentsNda,
          disclaimer: "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده...",
        })
      );
    }
    if (id === "cnt-emp-001") {
      return HttpResponse.json(ok(fixtureV1ContractDetailEmployment));
    }
    if (id === "cnt-partner-001") {
      return HttpResponse.json(ok(fixtureV1ContractDetailPartnership));
    }
    if (id === "cnt-saas-001") {
      return HttpResponse.json(ok(fixtureV1ContractDetailSaas));
    }
    if (id === "cnt-archived-001") {
      return HttpResponse.json(ok(fixtureV1ContractDetailContracting));
    }

    return HttpResponse.json(err("NOT_FOUND", "قرارداد یافت نشد", false), { status: 404 });
  }),

  // --- PATCH /api/v1/contracts/:id (Update) ---
  http.patch(`${API_BASE}/api/v1/contracts/:id`, async ({ params, request }) => {
    await delay(400);
    const body = (await request.json()) as Record<string, unknown>;
    const id = params["id"] as string;

    if (id === "cnt-lease-001") {
      const updated = {
        ...fixtureV1ContractDetail,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      return HttpResponse.json(ok(updated));
    }

    return HttpResponse.json(err("NOT_FOUND", "قرارداد یافت نشد", false), { status: 404 });
  }),

  // --- POST /api/v1/contracts/:id/generate ---
  http.post(`${API_BASE}/api/v1/contracts/:id/generate`, async ({ params, request }) => {
    await delay(2000);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: generation fails
    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("GENERATION_FAILED", "خطا در تولید قرارداد. لطفاً مجدداً تلاش کنید.", true),
        { status: 500 }
      );
    }

    // Scenario: timeout simulation
    if (url.searchParams.get("timeout") === "true") {
      await delay(15000);
    }

    if (id === "cnt-lease-001" || id.startsWith("cnt-")) {
      return HttpResponse.json(ok(fixtureV1GenerateResponse));
    }

    return HttpResponse.json(err("NOT_FOUND", "قرارداد یافت نشد", false), { status: 404 });
  }),

  // --- GET /api/v1/contracts/:id/versions ---
  http.get(`${API_BASE}/api/v1/contracts/:id/versions`, async ({ params }) => {
    await delay(300);
    const id = params["id"] as string;

    if (id === "cnt-lease-001") {
      return HttpResponse.json(
        ok([fixtureV1ContractVersion1, fixtureV1ContractVersion2])
      );
    }

    return HttpResponse.json(ok([]));
  }),

  // --- GET /api/v1/contracts/:id/analysis ---
  http.get(`${API_BASE}/api/v1/contracts/:id/analysis`, async ({ params, request }) => {
    await delay(500);
    const id = params["id"] as string;
    const url = new URL(request.url);

    // Scenario: analysis not ready
    if (url.searchParams.get("notReady") === "true") {
      return HttpResponse.json(
        err("ANALYSIS_NOT_READY", "تحلیل قرارداد هنوز آماده نیست", true),
        { status: 409 }
      );
    }

    if (id === "cnt-lease-001") {
      return HttpResponse.json(ok(fixtureV1ContractRiskAnalysis));
    }

    // Clean, low-risk analysis for the remaining sample contracts.
    if (id.startsWith("cnt-")) {
      return HttpResponse.json(
        ok({
          contractId: id,
          overallRisk: "low" as const,
          findings: [],
          protectiveSuggestions: [
            {
              id: `ps-${id}-1`,
              title: "بند حل اختلاف",
              content:
                "در صورت بروز اختلاف، طرفین ابتدا به مذاکره و سپس به داوری مراجعه خواهند نمود.",
              isProtective: true,
              importance: "recommended" as const,
            },
          ],
          generatedAt: new Date().toISOString(),
        })
      );
    }

    return HttpResponse.json(err("NOT_FOUND", "قرارداد یافت نشد", false), { status: 404 });
  }),

  // --- POST /api/v1/contracts/:id/archive ---
  http.post(`${API_BASE}/api/v1/contracts/:id/archive`, async ({ params, request }) => {
    await delay(600);
    const id = params["id"] as string;
    const url = new URL(request.url);

    if (url.searchParams.get("fail") === "true") {
      return HttpResponse.json(
        err("ARCHIVE_FAILED", "خطا در بایگانی قرارداد", true),
        { status: 500 }
      );
    }

    return HttpResponse.json(
      ok({ id, state: "archived" as const })
    );
  }),

  // =========================================
  // PHASE 10 — CONTRACT DRAFTS
  // =========================================

  // --- POST /api/v1/contracts/drafts ---
  http.post(`${API_BASE}/api/v1/contracts/drafts`, async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { typeId: string };

    const existing = draftStore.get(body.typeId);
    if (existing) {
      return HttpResponse.json(
        ok({
          id: `draft-${body.typeId}`,
          contractId: null,
          typeId: body.typeId,
          currentStep: existing.currentStep,
          answers: existing.answers,
          savedAt: existing.savedAt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    }

    const draft = {
      typeId: body.typeId,
      currentStep: 1,
      answers: {} as Record<string, string>,
      savedAt: null,
    };
    draftStore.set(body.typeId, draft);

    return HttpResponse.json(
      ok({
        id: `draft-${body.typeId}`,
        contractId: null,
        typeId: body.typeId,
        currentStep: 1,
        answers: {},
        savedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  // --- GET /api/v1/contracts/drafts/:typeId ---
  http.get(`${API_BASE}/api/v1/contracts/drafts/:typeId`, async ({ params }) => {
    await delay(200);
    const typeId = params["typeId"] as string;
    const existing = draftStore.get(typeId);

    if (existing) {
      return HttpResponse.json(
        ok({
          id: `draft-${typeId}`,
          contractId: null,
          typeId,
          currentStep: existing.currentStep,
          answers: existing.answers,
          savedAt: existing.savedAt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    }

    return HttpResponse.json(ok(null));
  }),

  // --- PATCH /api/v1/contracts/drafts/:typeId ---
  http.patch(`${API_BASE}/api/v1/contracts/drafts/:typeId`, async ({ params, request }) => {
    await delay(300);
    const typeId = params["typeId"] as string;
    const body = (await request.json()) as { currentStep: number; answers: Record<string, string> };

    const draft = {
      typeId,
      currentStep: body.currentStep,
      answers: body.answers,
      savedAt: new Date().toISOString(),
    };
    draftStore.set(typeId, draft);

    return HttpResponse.json(
      ok({
        id: `draft-${typeId}`,
        contractId: null,
        typeId,
        currentStep: body.currentStep,
        answers: body.answers,
        savedAt: draft.savedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  // --- DELETE /api/v1/contracts/drafts/:typeId ---
  http.delete(`${API_BASE}/api/v1/contracts/drafts/:typeId`, async ({ params }) => {
    await delay(200);
    const typeId = params["typeId"] as string;
    draftStore.delete(typeId);

    return HttpResponse.json(ok({ deleted: true as const }));
  }),

  // =========================================
  // PHASE 11 — HISTORY
  // =========================================

  http.get(`${API_BASE}/api/v1/history`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);

    let items = [...fixtureV1HistoryItems];

    // Category filter
    const category = url.searchParams.get("category");
    if (category && category !== "all") {
      items = items.filter((i) => i.category === category);
    }

    // Search filter
    const search = url.searchParams.get("search");
    if (search) {
      items = items.filter((i) => i.title.includes(search) || (i.description?.includes(search) ?? false));
    }

    // Type filter
    const type = url.searchParams.get("type");
    if (type && type !== "all") {
      items = items.filter((i) => i.type === type);
    }

    // Sort
    const sort = url.searchParams.get("sort") ?? "newest";
    if (sort === "oldest") {
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title, "fa"));
    } else {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20");

    return HttpResponse.json(
      ok(
        { items, pagination: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) } }
      )
    );
  }),

  // =========================================
  // PHASE 11 — MEMORIES
  // =========================================

  http.get(`${API_BASE}/api/v1/memories`, async () => {
    await delay(300);
    return HttpResponse.json(
      ok({ items: fixtureV1MemoryItems, memoryEnabled: true })
    );
  }),

  http.patch(`${API_BASE}/api/v1/memories/:id`, async ({ params, request }) => {
    await delay(400);
    const body = (await request.json()) as { key?: string; value?: string; status?: string };
    const id = params["id"] as string;
    const item = fixtureV1MemoryItems.find((m) => m.id === id);

    if (!item) {
      return HttpResponse.json(
        err("NOT_FOUND", "آیتم حافظه یافت نشد", false),
        { status: 404 }
      );
    }

    const updated = { ...item, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json(ok(updated));
  }),

  http.delete(`${API_BASE}/api/v1/memories/:id`, async ({ params }) => {
    await delay(400);
    const id = params["id"] as string;
    const exists = fixtureV1MemoryItems.some((m) => m.id === id);

    if (!exists) {
      return HttpResponse.json(
        err("NOT_FOUND", "آیتم حافظه یافت نشد", false),
        { status: 404 }
      );
    }

    return HttpResponse.json(ok({ deleted: true as const }));
  }),

  // =========================================
  // PHASE 11 — PREFERENCES
  // =========================================

  http.get(`${API_BASE}/api/v1/me/preferences`, async () => {
    await delay(300);
    return HttpResponse.json(
      ok({
        theme: "light" as const,
        locale: "fa-IR" as const,
        showProfileCompletionPrompt: true,
        notifications: {
          appointments: true,
          contractExpiry: true,
          lawyerResponse: true,
          paymentStatus: true,
          caseUpdate: true,
          marketing: false,
        },
        privacy: {
          shareUsageData: true,
          allowAiTraining: false,
          storeConversationHistory: true,
          autoMemoryConsent: false,
        },
      })
    );
  }),

  http.patch(`${API_BASE}/api/v1/me/preferences`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as Record<string, unknown>;

    const current = {
      theme: "light" as const,
      locale: "fa-IR" as const,
      showProfileCompletionPrompt: true,
      notifications: {
        appointments: true,
        contractExpiry: true,
        lawyerResponse: true,
        paymentStatus: true,
        caseUpdate: true,
        marketing: false,
      },
      privacy: {
        shareUsageData: true,
        allowAiTraining: false,
        storeConversationHistory: true,
        autoMemoryConsent: false,
      },
    };

    const updated = {
      ...current,
      ...body,
      notifications: { ...current.notifications, ...(body['notifications'] as object ?? {}) },
      privacy: { ...current.privacy, ...(body['privacy'] as object ?? {}) },
    };

    return HttpResponse.json(ok(updated));
  }),

  // =========================================
  // PHASE 11 — SUBSCRIPTION HISTORY
  // =========================================

  http.get(`${API_BASE}/api/v1/subscription-history`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20");

    return HttpResponse.json(
      ok({
        items: fixtureV1SubscriptionHistory,
        pagination: { page, pageSize, total: fixtureV1SubscriptionHistory.length, totalPages: 1 },
      })
    );
  }),

  // =========================================
  // PHASE 11 — PROFILE USAGE
  // =========================================

  http.get(`${API_BASE}/api/v1/profile/usage`, async () => {
    await delay(300);
    return HttpResponse.json(ok(fixtureProfileUsage));
  }),

  // =========================================
  // LEGAL LIBRARY — Legal Knowledge Endpoints
  // =========================================

  // --- GET /api/v1/legal-library ---
  http.get(`${API_BASE}/api/v1/legal-library`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? "";
    const topic = url.searchParams.get("topic") ?? "";
    const sourceType = url.searchParams.get("sourceType") ?? "";

    let items = fixtureLegalLibraryListItems;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q));
    }
    if (topic) {
      items = items.filter((i) => i.topicSlug === topic);
    }
    if (sourceType) {
      items = items.filter((i) => i.sourceType === sourceType);
    }

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20");

    return HttpResponse.json(
      ok({ items, pagination: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) } })
    );
  }),

  // --- GET /api/v1/legal-library/topics ---
  http.get(`${API_BASE}/api/v1/legal-library/topics`, async () => {
    await delay(300);
    return HttpResponse.json(ok(fixtureLegalLibraryTopics));
  }),

  // --- GET /api/v1/legal-library/search ---
  http.get(`${API_BASE}/api/v1/legal-library/search`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();

    let items = fixtureLegalLibraryListItems;
    if (q) {
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q));
    }

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20");

    return HttpResponse.json(
      ok({ items, pagination: { page, pageSize, total: items.length, totalPages: 1 }, query: q, normalizedQuery: q })
    );
  }),

  // --- GET /api/v1/legal-library/:id ---
  http.get(`${API_BASE}/api/v1/legal-library/:id`, async ({ params }) => {
    await delay(400);
    const id = params["id"] as string;
    const source = fixtureLegalSourceDetails[id];
    if (!source) {
      return HttpResponse.json(err("NOT_FOUND", "منبع حقوقی یافت نشد", false), { status: 404 });
    }
    return HttpResponse.json(ok(source));
  }),

  // --- POST /api/v1/legal-library/:id/bookmark ---
  http.post(`${API_BASE}/api/v1/legal-library/:id/bookmark`, async () => {
    await delay(300);
    return HttpResponse.json(ok({ bookmarked: true }));
  }),

  // --- DELETE /api/v1/legal-library/:id/bookmark ---
  http.delete(`${API_BASE}/api/v1/legal-library/:id/bookmark`, async () => {
    await delay(300);
    return HttpResponse.json(ok({ bookmarked: false }));
  }),

  // --- GET /api/v1/legal-library/bookmarks ---
  http.get(`${API_BASE}/api/v1/legal-library/bookmarks`, async () => {
    await delay(300);
    return HttpResponse.json(ok({ items: fixtureLegalLibraryListItems.slice(0, 3), pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 } }));
  }),

  // --- GET /api/v1/blog ---
  http.get(`${API_BASE}/api/v1/blog`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? "";
    let items = [...fixtureBlogListItems];

    if (category) {
      items = items.filter((i) => i.category === category);
    }

    return HttpResponse.json(
      ok({ items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } })
    );
  }),

  // --- GET /api/v1/blog/:slug ---
  http.get(`${API_BASE}/api/v1/blog/:slug`, async ({ params }) => {
    await delay(400);
    const slug = params["slug"] as string;
    const post = fixtureBlogPostDetails[slug];
    if (!post) {
      return HttpResponse.json(err("NOT_FOUND", "مطلب یافت نشد", false), { status: 404 });
    }
    return HttpResponse.json(ok(post));
  }),

  // =========================================
  // NOTIFICATION CENTER
  // =========================================

  http.get(`${API_BASE}/api/v1/notifications`, async () => {
    await delay(200);
    const items = fixtureNotifications;
    return HttpResponse.json(
      ok({ items, unreadCount: items.filter((n) => !n.read).length })
    );
  }),

  http.post(`${API_BASE}/api/v1/notifications/read-all`, async () => {
    await delay(200);
    const items = fixtureNotifications.map((n) => ({ ...n, read: true }));
    return HttpResponse.json(ok({ items, unreadCount: 0 }));
  }),

  http.post(`${API_BASE}/api/v1/notifications/:id/read`, async ({ params }) => {
    await delay(200);
    const id = decodeURIComponent(params["id"] as string);
    const items = fixtureNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    return HttpResponse.json(
      ok({ items, unreadCount: items.filter((n) => !n.read).length })
    );
  }),

];

