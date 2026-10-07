// ============================================================
// LEGALIR — AI content generation (server-only)
// ============================================================
// A single-shot text completion built on the SAME provider abstraction the
// chat stream uses (`lib/ai/provider`). It resolves the provider through the
// admin-configured runtime override first (`resolveRuntimeAiConfig`), then
// falls back to the environment — so an operator's provider settings on
// /admin/ai actually take effect here, honestly reporting when the result
// came from the development mock.
//
// This is deliberately NOT streaming to the browser: it is an admin-only,
// server-side call that returns a finished draft for review (never auto-
// published — see lib/admin/blog).
// ============================================================

import {
  createAiProvider,
  OpenAiCompatibleProvider,
  type AiProvider,
} from "./provider";
import { resolveRuntimeAiConfig } from "@/lib/admin/ai-providers";

export interface GeneratedContent {
  text: string;
  /** Provider name that produced the text ("openai-compatible" | "mock"). */
  provider: string;
  model: string;
  /** True when no real provider is configured (development mock output). */
  mock: boolean;
  totalTokens: number;
  /** True when token counts are a documented estimate, not provider-reported. */
  estimatedTokens: boolean;
}

/**
 * Resolve the effective provider: an admin-configured provider with a stored
 * key wins; otherwise the environment / development mock.
 */
function resolveProvider(): AiProvider {
  const runtime = resolveRuntimeAiConfig();
  if (runtime) {
    return new OpenAiCompatibleProvider({
      provider: "openai-compatible",
      model: runtime.model,
      apiKey: runtime.apiKey,
      baseUrl: runtime.baseUrl,
    });
  }
  return createAiProvider();
}

/** Run one completion to completion and return the concatenated text. */
export async function generateContentText(params: {
  system: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<GeneratedContent> {
  const provider = resolveProvider();
  let text = "";
  let totalTokens = 0;
  let estimated = false;

  for await (const delta of provider.stream({
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    signal: params.signal,
    onUsage: (u) => {
      totalTokens = u.totalTokens;
      estimated = u.estimated;
    },
  })) {
    text += delta;
  }

  return {
    text,
    provider: provider.name,
    model: provider.model,
    mock: !provider.configured,
    totalTokens,
    estimatedTokens: estimated,
  };
}
