# LEGALIER — Legal Intelligence Pipeline

The five-stage pipeline that turns a user message into a grounded legal
answer. Every stage is driven by real backend work; the UI advances only on
the corresponding SSE event, never on a timer.

> These are **not** court stages. They describe LEGALIER's internal process.

```
User Message
    ↓
① شناسایی            IDENTIFY
    ↓
② تکمیل اطلاعات      UNDERSTAND
    ↓
③ بررسی منابع        RESEARCH
    ↓
④ تحلیل حقوقی        ANALYZE
    ↓
⑤ پاسخ و اقدام بعدی  RESPOND
    ↓
Final Answer / Lawyer / Case / Document / Contract
```

---

## 1. Architecture

```
Browser (chat page)
  │  streamChat()  ── POST /api/v1/ai/stream (SSE)
  ▼
AI Gateway route  ── app/api/v1/ai/stream/route.ts
  │
  ├─ Stage 1  classifyMessage()          lib/ai/pipeline/classify.ts
  ├─ Stage 2  processWorkflowTurn()      lib/ai/workflow/engine.ts
  ├─ Stage 3  retrieveGroundedSources()  lib/ai/grounding.ts
  ├─ Stage 4  prompt composition         (route)
  └─ Stage 5  provider.stream()          lib/ai/provider.ts
  │
  └─ run persistence                     lib/ai/pipeline/run.ts
                                          → .data/chat-processing-runs.json
```

The stage model itself lives in `lib/ai/pipeline/stages.ts` (labels + copy)
and `@legalir/types` (`ProcessingStage`, `StageStatus`, `ChatProcessingRun`).

## 2. Stage definitions

| # | Stage | Persian | What actually happens |
|---|-------|---------|-----------------------|
| 1 | IDENTIFY | شناسایی مسئله | `classifyMessage()` — category, intent, `requires_*` flags, entities, risk flags |
| 2 | UNDERSTAND | تکمیل اطلاعات | `processWorkflowTurn()` — fact extraction, missing-info questions; may enter `WAITING` |
| 3 | RESEARCH | بررسی منابع | `retrieveGroundedSources()` — real retrieval; `SKIPPED` when the question needs no sources |
| 4 | ANALYZE | تحلیل حقوقی | Compose the grounded system prompt; set `requiresLawyerReview` |
| 5 | RESPOND | آماده‌سازی پاسخ | `provider.stream()` — token generation, then persist the assistant message |

## 3. State machine

`ProcessingStage`: `IDENTIFY → UNDERSTAND → RESEARCH → ANALYZE → RESPOND`

`StageStatus`: `PENDING | ACTIVE | COMPLETED | WAITING | FAILED | SKIPPED`

`ChatProcessingRunStatus`: `running | waiting | completed | failed | cancelled`

A stage is only `COMPLETED` once its real work has returned. `SKIPPED` is
used when a stage genuinely is not needed (e.g. no retrieval for a short
informational question) — the UI renders it as completed, with no fake delay.

## 4. SSE events

| Event | Meaning |
|-------|---------|
| `processing.started` | A run began; carries `requestId`, `totalStages` |
| `stage.started` | A stage began |
| `stage.completed` | A stage finished (may carry `status: "SKIPPED"`) |
| `stage.waiting` | Stage 2 needs more information from the user |
| `stage.failed` | A stage failed; carries `code`, `message`, `retryable` |
| `retrieval.started` / `retrieval.completed` | Stage 3 boundaries; completed carries `sourcesUsed` |
| `analysis.started` / `analysis.completed` | Stage 4 boundaries; completed carries `requiresLawyerReview` |
| `response.started` / `response.delta` / `response.completed` | Stage 5 boundaries |
| `processing.completed` | The run finished; carries `sourcesUsed`, `requiresLawyerReview` |

The pre-existing `status`, `chunk`, `done`, `error` and `workflow` events are
unchanged, so existing consumers keep working.

## 5. Frontend

- `lib/ai/stream-client.ts` — parses pipeline events into `PipelineProgress`
  and calls `onPipeline`.
- `app/(app)/chat/[id]/page.tsx` — holds `Record<ProcessingStage, StageStatus>`
  and advances it purely from `onPipeline`.
- `components/chat/legal-processing-progress.tsx` — the segmented circular
  indicator: five arcs, `N / ۵` in the centre, stage title + description,
  optional expanded stepper, error/retry/cancel, `aria-live`, reduced motion.

## 6. Persistence & observability

Each run is stored in `.data/chat-processing-runs.json` (capped at 500 rows):

```jsonc
{
  "id": "…", "conversationId": "…", "userId": "…",
  "userMessageId": "…", "assistantMessageId": "…",
  "status": "completed", "currentStage": "RESPOND",
  "stages": {
    "IDENTIFY":  { "status": "COMPLETED", "latencyMs": 2,  "metadata": {…} },
    "UNDERSTAND":{ "status": "COMPLETED", "latencyMs": 1,  "metadata": {…} },
    "RESEARCH":  { "status": "COMPLETED", "latencyMs": 14, "metadata": {…} },
    "ANALYZE":   { "status": "COMPLETED", "latencyMs": 0,  "metadata": {…} },
    "RESPOND":   { "status": "COMPLETED", "latencyMs": 812,"metadata": {…} }
  },
  "classification": { … }, "sourcesUsed": 3,
  "requiresLawyerReview": false, "totalLatencyMs": 829
}
```

This is what makes the pipeline measurable: per-stage latency answers
"where is LEGALIER slow — retrieval, analysis, or response generation?".

## 7. Error handling

- Retrieval failure → Stage 3 `FAILED`, the answer is told explicitly not to
  claim grounding, and the UI shows «در حال حاضر امکان بررسی منابع حقوقی
  وجود نداشت.» with a retry action.
- Provider failure → Stage 5 `FAILED`, run marked `failed`.
- User stop → run marked `cancelled` (distinct from failure).

## 8. Testing

`src/lib/__tests__/legal-pipeline.test.ts` pins the five-stage model, the
stage numbering, and the Stage-1 classifier. Chat integration behaviour is
covered by `src/app/__tests__/chat-workspace.test.tsx`.

## 9. Manual verification

1. Open `/chat/<conversationId>` and send a message.
2. The circular indicator should step ۱/۵ → ۵/۵ as the backend emits events.
3. Inspect `.data/chat-processing-runs.json` for the recorded latencies.
