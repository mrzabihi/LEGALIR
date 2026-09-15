# LEGALIR AI Workflow Agent — Architecture

## Overview

The AI Workflow Agent transforms LEGALIR's chat from a generic Q&A assistant into a **structured 5-phase legal workflow engine**. Each conversation follows a state machine that guides the user from initial inquiry through to actionable legal outcomes.

## State Machine

```
DISCOVERY → DATA_COLLECTION → ANALYSIS → RECOMMENDATION → ACTION
```

| Phase | Step | Purpose | Exit Condition |
|---|---|---|---|
| `DISCOVERY` | 1/5 | Detect legal domain and user intent | Intent confidence ≥ 0.5 or 2+ turns |
| `DATA_COLLECTION` | 2/5 | Gather missing facts via targeted questions | 4+ facts collected or 3+ turns |
| `ANALYSIS` | 3/5 | Structured legal analysis with citations | 1 turn (auto-advances) |
| `RECOMMENDATION` | 4/5 | Prioritized action recommendations | 1 turn (auto-advances) |
| `ACTION` | 5/5 | Help user take concrete steps (create case, draft docs) | Stays until conversation ends |

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  Frontend (chat page)                           │
│  ┌───────────────────────────────────────────┐  │
│  │ WorkflowProgress component                │  │
│  │ - 5-step progress bar                     │  │
│  │ - Domain badge                            │  │
│  │ - Phase transition hints                  │  │
│  │ - Pending questions display               │  │
│  │ - "Create Case" CTA button                │  │
│  └───────────────────────────────────────────┘  │
│                      ▲                           │
│          SSE "workflow" event                    │
└──────────────────────┼──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│  API Gateway (stream route)                     │
│  ┌───────────────────────────────────────────┐  │
│  │ processWorkflowTurn()                     │  │
│  │ - Loads state per conversationId          │  │
│  │ - Runs intent detection                   │  │
│  │ - Extracts facts from user message        │  │
│  │ - Determines next phase                   │  │
│  │ - Builds phase-specific system prompt     │  │
│  │ - Saves state back to store               │  │
│  │ - Emits { type: "workflow", ... } event   │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│  Workflow Engine (lib/ai/workflow/engine.ts)    │
│  ┌───────────────────────────────────────────┐  │
│  │ detectIntent()        — 16 patterns       │  │
│  │ extractFacts()        — regex extraction  │  │
│  │ generateMissingInfoQuestions() — 13 tmpl  │  │
│  │ determineNextPhase()  — transition rules  │  │
│  │ buildWorkflowSystemPrompt() — per-phase   │  │
│  │ processWorkflowTurn()  — orchestrator     │  │
│  └───────────────────────────────────────────┘  │
│  State Store: Map<conversationId, WorkflowState> │
└─────────────────────────────────────────────────┘
```

## Intent Detection

16 keyword patterns across 9 legal domains. Multi-word keywords (e.g., "تنظیم قرارداد") carry 2x weight vs single-word keywords for better specificity.

| Domain | Intents |
|---|---|
| `contract` | contract_dispute, contract_drafting, contract_review |
| `employment` | employment_dispute, employment_contract |
| `property` | property_dispute, rental_dispute |
| `family` | divorce, inheritance |
| `business` | company_dispute |
| `criminal` | criminal_defense, check_dispute |
| `financial` | debt_recovery, banking_dispute |
| `tax` | tax_consultation |
| `other` | general_legal_question |

## Fact Extraction

Heuristic regex extraction from Persian text:
- **Amounts**: `(\d[\d,]*)\s*(میلیون|هزار|ریال|تومان|میلیارد)` — supports Persian digits
- **Dates**: `۱۴[\d۰-۹][\d۰-۹]/[\d۰-۹]{1,2}/[\d۰-۹]{1,2}`
- **Parties**: `(?:آقای|خانم|شرکت)\s+([^\s،,]+)`
- **Cities**: 16 major Iranian cities
- **Documents**: keyword detection (قرارداد, مدرک, سند, etc.)

## Missing Info Questions

13 question templates, domain-filtered. Domain-specific questions are prioritized over generic ones. Max 4 questions per turn. Already-collected facts are skipped.

## Phase-Specific System Prompts

Each phase has a tailored Persian prompt instructing the AI on its role, output format, and constraints. The prompt includes:
- Current phase instructions
- Detected legal domain
- Collected facts summary
- Pending questions
- Grounding context (RAG sources)
- General rules (Persian-only, cite only verified sources, disclaimer)

## SSE Event: `workflow`

Emitted at the start of each turn before the AI response:

```typescript
{
  type: "workflow",
  phase: "DATA_COLLECTION",
  domain: "contract",
  intent: "contract_dispute",
  phaseChanged: true,
  pendingQuestions: ["مبلغ یا ارزش مالی مورد اختلاف چقدر است؟", ...],
  suggestCaseCreation: false
}
```

## State Persistence

In-memory `Map<conversationId, WorkflowState>`. State is ephemeral (lost on server restart). Designed to be upgraded to Redis or DB-backed storage for production.

## Integration Points

| File | Role |
|---|---|
| `lib/ai/workflow/engine.ts` | Core engine (types, detection, extraction, transitions) |
| `lib/ai/workflow/index.ts` | Barrel export |
| `app/api/v1/ai/stream/route.ts` | SSE gateway — calls processWorkflowTurn, emits workflow events |
| `lib/ai/stream-client.ts` | Browser client — parses workflow SSE events, exposes onWorkflow callback |
| `components/chat/workflow-progress.tsx` | UI component — progress bar, domain badge, questions, CTA |
| `components/chat/conversation-workspace.tsx` | Renders WorkflowProgress above messages |
| `app/(app)/chat/[id]/page.tsx` | Tracks workflow state, passes onCreateCase handler |
| `app/(app)/cases/page.tsx` | Auto-opens create modal from `?create=true` |

## Test Coverage

41 tests in `lib/__tests__/workflow-engine.test.ts`:
- Intent detection (9 tests) — all 9 domains, edge cases
- Fact extraction (6 tests) — amounts, dates, names, cities, documents, multi-fact
- Missing info questions (5 tests) — domain filtering, skip collected, max 4
- Phase transitions (8 tests) — all transitions, stay rules, force-advance
- Full turn processing (7 tests) — state accumulation, turn counting, case creation
- State persistence (2 tests) — store/retrieve, clear
- E2E scenarios (3 tests) — rental dispute, employment, contract drafting