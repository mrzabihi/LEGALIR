// ============================================================
// LEGALIR — AI Provider Abstraction (server-only)
// ============================================================
// The frontend never talks to an AI provider directly. It only
// talks to the LEGALIR backend (Next.js API route) which selects
// a provider here. Provider credentials are read from server-only
// environment variables and are NEVER exposed to the browser.
//
// Supported providers:
//   - "mock"               → deterministic Development Mock (no key)
//   - "openai-compatible"  → any OpenAI-compatible /v1/chat/completions
//                             endpoint (OpenAI, Groq, DeepSeek, Together,
//                             local Ollama/OpenWebUI, etc.)
//
// Env vars (server-only, never NEXT_PUBLIC_*):
//   LEGALIR_AI_PROVIDER   = mock | openai-compatible   (default: mock)
//   LEGALIR_AI_MODEL      = model id                    (default: gpt-4o-mini)
//   LEGALIR_AI_API_KEY    = provider key                (also AI_PROVIDER_API_KEY)
//   LEGALIR_AI_BASE_URL   = OpenAI-compatible base URL  (default: https://api.openai.com/v1)
// ============================================================

export interface AiProviderConfig {
  provider: "mock" | "openai-compatible";
  model: string;
  apiKey: string | null;
  baseUrl: string;
}

/** Actual token usage reported by the provider for one completion. */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** True when the numbers are a documented fallback, not provider-reported. */
  estimated: boolean;
}

export interface AiStreamParams {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
  /** Called once with the completion's token usage, when known. */
  onUsage?: (usage: AiUsage) => void;
}

/**
 * A swappable AI provider. Implementations only stream text deltas;
 * grounding, prompt templating and SSE framing are handled by the
 * gateway route so providers stay provider-agnostic and replaceable.
 */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** True when real credentials are available (false for the mock). */
  readonly configured: boolean;
  stream(params: AiStreamParams): AsyncIterable<string>;
  health(): Promise<{ ok: boolean; error?: string }>;
  models(): string[];
}

// ============================================================
// Environment resolution
// ============================================================

const env = process.env;

export function readAiProviderConfig(): AiProviderConfig {
  const providerRaw = (env["LEGALIR_AI_PROVIDER"] ?? "mock").toLowerCase();
  const provider: AiProviderConfig["provider"] =
    providerRaw === "openai" ||
    providerRaw === "openai-compatible" ||
    providerRaw === "anthropic" ||
    providerRaw === "custom"
      ? "openai-compatible"
      : "mock";

  const apiKey = env["LEGALIR_AI_API_KEY"] ?? env["AI_PROVIDER_API_KEY"] ?? null;
  const model =
    env["LEGALIR_AI_MODEL"] ??
    (provider === "mock" ? "legalir-mock-v1" : "gpt-4o-mini");
  const baseUrl =
    env["LEGALIR_AI_BASE_URL"] ?? "https://api.openai.com/v1";

  return { provider, model, apiKey, baseUrl };
}

// ============================================================
// Mock provider
// ============================================================

const MOCK_SECTIONS = (question: string): string[] => [
  "## خلاصه",
  "بر اساس اطلاعات ارائه‌شده، موضوع شما قابل بررسی از منظر حقوقی است. در ادامه، تحلیل اولیه، ریسک‌های احتمالی و اقدامات پیشنهادی ارائه می‌شود تا دید روشنی نسبت به وضعیت حقوقی خود داشته باشید.",
  "",
  "## تحلیل اولیه",
  `در خصوص «${question}»، با توجه به قوانین موضوعه و رویه قضایی ایران، ابتدا باید ماهیت حقوقی مسئله مشخص شود. دستیار حقوقی لیگالیر منابع مرتبط را بازیابی کرده و تحلیل را بر مبنای قوانین معتبر و آرای وحدت رویه ارائه می‌دهد.`,
  "",
  "## ریسک‌ها",
  "۱. امکان طولانی شدن فرایند رسیدگی در صورت نبود مستندات کافی.\n۲. از دست رفتن حق قانونی در صورت انقضای مهلت‌های قانونی.\n۳. پیچیدگی تفسیر در صورت وجود ابهام در قرارداد یا اسناد.",
  "",
  "## اقدامات پیشنهادی",
  "۱. جمع‌آوری و مستندسازی کامل مدارک و مستندات مرتبط.\n۲. ارسال اظهارنامه رسمی در صورت لزوم.\n۳. مشاوره با وکیل متخصص برای اتخاذ بهترین مسیر.\n۴. پیگیری موضوع در مرجع صالح قانونی.",
  "",
  "## هشدار حقوقی",
  "این تحلیل توسط هوش مصنوعی لیگالیر تولید شده و جایگزین مشاوره تخصصی وکیل نیست. پیش از هر اقدام حقوقی، با وکیل متخصص مشورت کنید.",
];

function mockFullText(question: string): string {
  return MOCK_SECTIONS(question).join("\n");
}

/**
 * Documented fallback token estimate (≈4 characters per token). Only used
 * when the provider does not report actual usage — never in place of real
 * provider numbers.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function* chunkText(text: string, chunkSize = 6): Generator<string> {
  // Split on word boundaries (Persian words) for a natural token-like flow.
  const tokens = text.split(/(\s+)/);
  let buffer = "";
  for (const token of tokens) {
    buffer += token;
    if (buffer.length >= chunkSize) {
      yield buffer;
      buffer = "";
    }
  }
  if (buffer) yield buffer;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model: string;
  readonly configured = false;

  constructor(model: string) {
    this.model = model;
  }

  async *stream(params: AiStreamParams): AsyncIterable<string> {
    const question = params.messages[params.messages.length - 1]?.content ?? "";
    const text = mockFullText(question);
    for (const chunk of chunkText(text)) {
      await sleep(18, params.signal);
      yield chunk;
    }
    // The mock has no provider-reported usage. Report a documented estimate
    // (≈4 chars/token) so the token quota still moves in development.
    if (params.onUsage) {
      const inputTokens = estimateTokens(params.system + question);
      const outputTokens = estimateTokens(text);
      params.onUsage({
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimated: true,
      });
    }
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  models(): string[] {
    return [this.model];
  }
}

// ============================================================
// OpenAI-compatible provider
// ============================================================

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  readonly configured: boolean;
  private readonly apiKey: string | null;
  private readonly baseUrl: string;

  constructor(config: AiProviderConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.configured = Boolean(this.apiKey);
  }

  async *stream(params: AiStreamParams): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error("AI provider is not configured (missing API key)");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        temperature: 0.3,
        // Ask OpenAI-compatible providers to include a final usage chunk.
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: params.system },
          ...params.messages,
        ],
      }),
      signal: params.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`AI provider error ${response.status}: ${detail.slice(0, 200)}`);
    }

    if (!response.body) {
      throw new Error("AI provider returned an empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let usageReported = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          if (!usageReported && params.onUsage) {
            // Provider did not send a usage chunk — fall back to an estimate.
            const inputTokens = estimateTokens(
              params.system + params.messages.map((m) => m.content).join(" ")
            );
            params.onUsage({
              inputTokens,
              outputTokens: 0,
              totalTokens: inputTokens,
              estimated: true,
            });
          }
          return;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            };
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
          // The final chunk carries the real token usage.
          if (json.usage && params.onUsage) {
            usageReported = true;
            const inputTokens = json.usage.prompt_tokens ?? 0;
            const outputTokens = json.usage.completion_tokens ?? 0;
            params.onUsage({
              inputTokens,
              outputTokens,
              totalTokens: json.usage.total_tokens ?? inputTokens + outputTokens,
              estimated: false,
            });
          }
        } catch {
          // Ignore malformed keep-alive/comment lines.
        }
      }
    }
  }

  async health(): Promise<{ ok: boolean; error?: string }> {
    if (!this.apiKey) return { ok: false, error: "missing api key" };
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return { ok: res.ok, error: res.ok ? undefined : `status ${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "network error" };
    }
  }

  models(): string[] {
    return [this.model];
  }
}

// ============================================================
// Factory
// ============================================================

export function createAiProvider(config?: AiProviderConfig): AiProvider {
  const cfg = config ?? readAiProviderConfig();

  if (cfg.provider === "openai-compatible" && cfg.apiKey) {
    return new OpenAiCompatibleProvider(cfg);
  }

  // Default / graceful fallback → deterministic Development Mock.
  return new MockAiProvider("legalir-mock-v1");
}
