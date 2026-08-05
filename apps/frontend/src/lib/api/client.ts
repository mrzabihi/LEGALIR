// ============================================================
// LEGALIR — Production-Ready API Client
// ============================================================
// Centralized fetch wrapper with:
//  - Environment-based API base URL (from @legalir/config)
//  - Correlation ID generation & propagation
//  - Standard error mapping via ApiClientError
//  - Idempotency-Key injection for create operations
//  - Cookie-based auth (credentials: "include")
//  - AbortSignal support for request cancellation
// ============================================================

import type { ApiSuccess } from "@legalir/types";
import { env } from "@legalir/config";
import { parseApiError } from "./errors";
import {
  requiresIdempotencyKey,
  generateIdempotencyKey,
  IDEMPOTENCY_HEADER,
} from "./idempotency";

// --- Correlation ID ---

const CORRELATION_HEADER = "X-Correlation-Id";

function generateCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- API Base URL ---

function getApiBase(): string {
  return env.apiBaseUrl;
}

// --- Request Options ---

interface RequestOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Skip idempotency-key injection (for safe/read-only retries) */
  skipIdempotency?: boolean;
  /** Custom correlation ID (for chained requests) */
  correlationId?: string;
}

// --- Generic Request ---

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBase();
  const url = `${baseUrl}${path}`;
  const correlationId = options.correlationId ?? generateCorrelationId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    [CORRELATION_HEADER]: correlationId,
  };

  // Inject idempotency key for create/mutate operations
  if (requiresIdempotencyKey(method, path) && !options.skipIdempotency) {
    headers[IDEMPOTENCY_HEADER] = generateIdempotencyKey();
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch {
    throw parseApiError(
      new Response(JSON.stringify({ code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true }), {
        status: 0,
        headers: new Headers(),
      })
    );
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const json = (await response.json()) as ApiSuccess<T>;
  return json.data;
}

// --- Public API ---

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },
};

// --- Auth-specific client (returns full ApiSuccess envelope) ---

async function authRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ApiSuccess<T>> {
  const baseUrl = getApiBase();
  const url = `${baseUrl}${path}`;
  const correlationId = options.correlationId ?? generateCorrelationId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    [CORRELATION_HEADER]: correlationId,
  };

  if (requiresIdempotencyKey(method, path) && !options.skipIdempotency) {
    headers[IDEMPOTENCY_HEADER] = generateIdempotencyKey();
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw parseApiError(
      new Response(JSON.stringify({ code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true }), {
        status: 0,
        headers: new Headers(),
      })
    );
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<ApiSuccess<T>>;
}

export const authClient = {
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiSuccess<T>> {
    return authRequest<T>("POST", path, body, options);
  },
};
