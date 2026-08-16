# AI Provider Architecture

**Section:** §16–§27, §42–§45
**Status:** Implemented

## Provider abstraction

`src/lib/ai/provider.ts` defines an `AiProvider` interface with `stream()`,
`health()`, and `models()`. Two implementations are provided:

- **`MockAiProvider`** — deterministic markdown streaming (no network/key),
  emitting Persian legal sections (خلاصه، تحلیل اولیه، ریسک‌ها، اقدامات
  پیشنهادی، هشدار حقوقی) chunked on word boundaries.
- **`OpenAiCompatibleProvider`** — real LLM streaming via any
  OpenAI-compatible `/chat/completions` endpoint using `stream: true` and
  `data:` SSE parsing.

`createAiProvider()` reads server-only env and returns the right provider.

## Backend gateway

`src/app/api/v1/ai/stream/route.ts` is the single SSE gateway:

- `POST` validates the `legalir-session` cookie, `conversationId`, and
  `content`.
- `buildSystemPrompt(serviceType, contextBlock)` constructs the Persian legal
  assistant prompt with the §24 grounding rule (no fabricated citations).
- `retrieveGroundedSources(query)` (in `grounding.ts`) performs lexical,
  deterministic Persian retrieval against the Legal Library and returns an
  empty list when no reliable source matches — never inventing citations.
- `streamAssistant()` persists the user message, increments usage, streams
  provider deltas as `{type:"chunk"}` frames, then persists the assistant
  message with sections + references and emits `{type:"done"}`.
- `GET` returns `{provider, model, configured, healthy, providerRequested}`
  with no secrets.

## Environment config

Documented in `.env.example`:

- `LEGALIR_AI_PROVIDER` (`mock` | `openai-compatible`)
- `LEGALIR_AI_MODEL`
- `LEGALIR_AI_API_KEY` (fallback: `AI_PROVIDER_API_KEY`)
- `LEGALIR_AI_BASE_URL`

All server-only; none are prefixed `NEXT_PUBLIC_`.

## Fallback

If the provider is unavailable, the client (`stream-client.ts`) invokes
`onError`, which falls back to the existing message endpoint and renders the
approved copy «در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.» with a
«تلاش دوباره» action. Internal provider names are never shown to users.

## Streaming

`stream-client.ts` is a browser SSE parser (`\n\n` frame delimiter) dispatching
`onStatus`, `onChunk`, `onDone`, `onError`. The chat page wires it through
`handleSendMessage` with a `finish()` that invalidates conversation and
reference queries.

## Security

- API keys live server-side only and are never in the client bundle.
- No full legal conversation content is logged in production-style logs.
- No uploaded document contents are logged.
