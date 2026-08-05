// ============================================================
// LEGALIR — Standard API Error Mapping
// ============================================================
// Maps HTTP status codes and backend error codes to typed errors.
// All API consumers should catch ApiClientError and inspect
// error.code to decide on UI treatment (toast, redirect, retry).
// ============================================================

import type { ApiError, FieldError } from "@legalir/types";

// --- Error Code Catalog ---

export const ERROR_CODES = {
  // 400 — Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_MOBILE: "INVALID_MOBILE",
  INVALID_PLAN: "INVALID_PLAN",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_STATE: "INVALID_STATE",
  // 401 — Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_INVALID: "OTP_INVALID",
  OTP_REUSED: "OTP_REUSED",
  // 403 — Authorization
  FORBIDDEN: "FORBIDDEN",
  ACCESS_DENIED: "ACCESS_DENIED",
  PLAN_RESTRICTED: "PLAN_RESTRICTED",
  // 404 — Not Found
  NOT_FOUND: "NOT_FOUND",
  GONE: "GONE",
  SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
  // 409 — Conflict
  CONFLICT: "CONFLICT",
  ANALYSIS_NOT_READY: "ANALYSIS_NOT_READY",
  // 429 — Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  // 500 — Server Error
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  CREATE_FAILED: "CREATE_FAILED",
  FETCH_FAILED: "FETCH_FAILED",
  DELETE_FAILED: "DELETE_FAILED",
  ARCHIVE_FAILED: "ARCHIVE_FAILED",
  RETRY_FAILED: "RETRY_FAILED",
  // 503 — Unavailable
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  // Network
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// --- HTTP Status → Error Category ---

export type ErrorCategory =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "server_error"
  | "unavailable"
  | "network";

export function categorizeError(status: number, _code?: string): ErrorCategory {
  if (status === 400) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 410) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 503) return "unavailable";
  if (status >= 500) return "server_error";
  // Network failures (status 0 from fetch) or unexpected
  return "network";
}

// --- User-Facing Messages (Persian) ---

const CATEGORY_MESSAGES: Record<ErrorCategory, string> = {
  validation: "اطلاعات واردشده معتبر نیست. لطفاً خطاها را بررسی کنید.",
  unauthorized: "نیاز به ورود مجدد دارید. لطفاً وارد شوید.",
  forbidden: "شما دسترسی به این بخش را ندارید.",
  not_found: "اطلاعات درخواستی یافت نشد.",
  conflict: "درخواست شما با وضعیت فعلی تداخل دارد.",
  rate_limited: "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید.",
  server_error: "خطای داخلی سرور رخ داد. لطفاً بعداً تلاش کنید.",
  unavailable: "سرویس موقتاً در دسترس نیست. لطفاً بعداً تلاش کنید.",
  network: "خطا در ارتباط با سرور. لطفاً اتصال اینترنت را بررسی کنید.",
};

// --- ApiClientError Class ---

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly correlationId: string;
  public readonly retryable: boolean;
  public readonly fieldErrors?: FieldError[];
  public readonly nextAction?: string;
  public readonly status: number;

  constructor(status: number, apiError: Partial<ApiError>) {
    const code = apiError.code ?? "UNKNOWN_ERROR";
    super(apiError.message ?? CATEGORY_MESSAGES[categorizeError(status, code)]);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.category = categorizeError(status, code);
    this.correlationId = apiError.correlationId ?? "unknown";
    this.retryable = apiError.retryable ?? (status >= 500 || status === 429);
    this.fieldErrors = apiError.fieldErrors;
    this.nextAction = apiError.nextAction;
  }

  /** Get a Persian user-facing message for this error. */
  get userMessage(): string {
    return this.message;
  }

  /** Whether this error should trigger an auth redirect. */
  get requiresReauth(): boolean {
    return this.category === "unauthorized";
  }

  /** Whether the client should retry automatically. */
  get shouldAutoRetry(): boolean {
    return this.retryable && this.category !== "rate_limited";
  }
}

/** Build an ApiClientError from a non-ok fetch response. */
export async function parseApiError(response: Response): Promise<ApiClientError> {
  let body: Partial<ApiError> = {};
  try {
    body = (await response.json()) as ApiError;
  } catch {
    // Response wasn't valid JSON — use defaults
  }
  return new ApiClientError(response.status, body);
}
