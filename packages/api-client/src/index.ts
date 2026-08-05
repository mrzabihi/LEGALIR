// ============================================================
// LEGALIR — API Client (Provider-Independent)
// ============================================================

import type { ApiSuccess, ApiError } from "@legalir/types";

export interface ApiClientConfig {
  baseUrl: string;
  onUnauthorized?: () => void;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly correlationId: string;
  public readonly retryable: boolean;
  public readonly fieldErrors?: Array<{ path: string; reason: string }>;
  public readonly nextAction?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.correlationId = error.correlationId;
    this.retryable = error.retryable;
    this.fieldErrors = error.fieldErrors;
    this.nextAction = error.nextAction;
  }
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal }
  ): Promise<ApiSuccess<T>> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
      credentials: "include",
    });

    if (response.status === 401) {
      this.config.onUnauthorized?.();
    }

    const json = await response.json();

    if (!response.ok) {
      const error = json as ApiError;
      throw new ApiClientError(error);
    }

    return json as ApiSuccess<T>;
  }

  get<T>(path: string, signal?: AbortSignal): Promise<ApiSuccess<T>> {
    return this.request<T>("GET", path, undefined, { signal });
  }

  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<ApiSuccess<T>> {
    return this.request<T>("POST", path, body, { signal });
  }

  patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<ApiSuccess<T>> {
    return this.request<T>("PATCH", path, body, { signal });
  }

  delete<T>(path: string, signal?: AbortSignal): Promise<ApiSuccess<T>> {
    return this.request<T>("DELETE", path, undefined, { signal });
  }
}

// Singleton factory — configured at app init
let clientInstance: ApiClient | null = null;

export function createApiClient(config: ApiClientConfig): ApiClient {
  clientInstance = new ApiClient(config);
  return clientInstance;
}

export function getApiClient(): ApiClient {
  if (!clientInstance) {
    throw new Error("ApiClient not initialized. Call createApiClient() first.");
  }
  return clientInstance;
}
