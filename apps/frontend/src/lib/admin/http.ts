// ============================================================
// LEGALIR — Admin route helpers (server-only)
// ============================================================
// Shared plumbing for the admin API: uniform error envelopes, a data-layer
// error→HTTP mapper, JSON body parsing, and request metadata for the audit
// trail (ip + correlation id). Keeps every admin route consistent.
// ============================================================

import { NextResponse } from "next/server";

/** A structured admin error response. */
export function adminError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status });
}

/** Persian messages + HTTP statuses for the data layer's error codes. */
const ERROR_MAP: Record<string, { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: "موردی یافت نشد" },
  USER_NOT_FOUND: { status: 404, message: "کاربر یافت نشد" },
  ORDER_NOT_FOUND: { status: 404, message: "سفارش یافت نشد" },
  PLAN_NOT_FOUND: { status: 404, message: "پلن مورد نظر یافت نشد" },
  INVALID_AMOUNT: { status: 400, message: "مبلغ نامعتبر است" },
  INVALID_PERCENT: { status: 400, message: "درصد کمیسیون باید بین ۰ تا ۱۰۰ باشد" },
  INVALID_FEE: { status: 400, message: "مبلغ ثابت نامعتبر است" },
  INVALID_TIMEOUT: { status: 400, message: "بازه زمانی نامعتبر است" },
  INVALID_MAX_TOKENS: { status: 400, message: "حداکثر توکن نامعتبر است" },
  INVALID_PERIOD: { status: 400, message: "بازه زمانی نامعتبر است" },
  INVALID_TRANSITION: { status: 409, message: "این تغییر وضعیت مجاز نیست" },
  EXCEEDS_ORDER: { status: 400, message: "مبلغ بازگشتی از مبلغ سفارش بیشتر است" },
  REASON_REQUIRED: { status: 400, message: "وارد کردن دلیل الزامی است" },
  SUBJECT_REQUIRED: { status: 400, message: "موضوع تیکت الزامی است" },
  BODY_REQUIRED: { status: 400, message: "متن پیام الزامی است" },
  TITLE_REQUIRED: { status: 400, message: "عنوان اطلاعیه الزامی است" },
  MESSAGE_REQUIRED: { status: 400, message: "متن اطلاعیه الزامی است" },
  INVALID_AUDIENCE: { status: 400, message: "مخاطب اطلاعیه نامعتبر است" },
  INVALID_STATUS: { status: 400, message: "وضعیت اطلاعیه نامعتبر است" },
  KEY_REQUIRED: { status: 400, message: "کلید نسخه الزامی است" },
  CONTENT_REQUIRED: { status: 400, message: "متن دستور الزامی است" },
  QUERY_REQUIRED: { status: 400, message: "عبارت جستجو الزامی است" },
  BLOG_TITLE_REQUIRED: { status: 400, message: "عنوان مقاله الزامی است" },
  TOPIC_REQUIRED: { status: 400, message: "موضوع مقاله الزامی است" },
  CALCULATOR_NOT_FOUND: { status: 404, message: "محاسبه‌گر یافت نشد" },
  INVALID_ACCESS_TIER: { status: 400, message: "سطح دسترسی محاسبه‌گر نامعتبر است" },
  INVALID_ENERGY_COST: { status: 400, message: "هزینهٔ انرژی محاسبه‌گر نامعتبر است" },
  NAME_REQUIRED: { status: 400, message: "نام ارائه‌دهنده الزامی است" },
  LAWYER_REQUIRED: { status: 400, message: "وکیل الزامی است" },
  PERIOD_REQUIRED: { status: 400, message: "بازه زمانی الزامی است" },
  ALREADY_DECIDED: { status: 409, message: "این درخواست قبلاً تصمیم‌گیری شده است" },
  SECOND_APPROVER_REQUIRED: {
    status: 409,
    message: "تأیید عملیات مالی نیازمند تأییدکننده دوم و متفاوت است",
  },
  NOT_APPROVED: { status: 409, message: "پیش از پرداخت، تسویه باید تأیید شود" },
  LOCKED: { status: 409, message: "این تسویه دیگر قابل ویرایش نیست" },
  LAST_SUPERADMIN: { status: 409, message: "آخرین مدیر ارشد را نمی‌توان تنزل داد" },
  PLAN_REQUIRED: { status: 400, message: "انتخاب پلن الزامی است" },
  NO_ACTIVE_SUBSCRIPTION: { status: 409, message: "کاربر اشتراک فعالی ندارد" },
  INVALID_DAYS: { status: 400, message: "تعداد روز نامعتبر است" },
  INSUFFICIENT_BALANCE: { status: 409, message: "موجودی انرژی برای این کاهش کافی نیست" },
  UNKNOWN_ACTION: { status: 400, message: "عملیات ناشناخته است" },
  SECRET_STORAGE_UNCONFIGURED: {
    status: 503,
    message: "ذخیره‌سازی امن کلیدها پیکربندی نشده است؛ برای ذخیره کلید، LEGALIR_ADMIN_SECRET_KEY را تنظیم کنید",
  },
};

/** Map a data-layer error code to a ready-to-return response. */
export function mapDataError(err: string): NextResponse {
  const mapped = ERROR_MAP[err] ?? { status: 400, message: "درخواست نامعتبر است" };
  return adminError(mapped.status, err, mapped.message);
}

/** Parse a JSON body, returning null on malformed input. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Best-effort client metadata for the audit trail. */
export function requestMeta(request: Request): { ip: string | null; requestId: string | null } {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : request.headers.get("x-real-ip");
  const requestId = request.headers.get("x-correlation-id") ?? request.headers.get("x-request-id");
  return { ip: ip ?? null, requestId: requestId ?? null };
}

/** Parse a positive integer query param with a fallback. */
export function intParam(url: URL, key: string, fallback: number): number {
  const raw = url.searchParams.get(key);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
