# LEGALIR — Real Dashboard Overview + Local Legal Knowledge Ingestion

**Version:** 0.3.0
**Date:** 2026-08-22
**Branch:** feature/legalir-v0.3-rewards-profile

---

## Summary

This phase delivers two complementary capabilities with no change to the
existing IA, auth, OTP, navigation, subscription, chat, DB technology, or
design system:

1. **Real Dashboard Overview** — the Workplace Dashboard operational metrics
   are now computed from the JSON DB instead of hard-coded placeholders.
2. **Local Legal Knowledge Ingestion** — the 16 official law files under
   `iran legal/` are fingerprinted, chunked, and inverted-indexed into a
   searchable, citable corpus that feeds the chat grounding pipeline.

---

## Scope (what changed vs. what did not)

### Changed
- `src/lib/dashboard-metrics.ts` — new metrics computation module.
- `src/app/api/v1/dashboard/summary/route.ts` — real values replace mocks.
- `src/components/dashboard/widgets.tsx` — `SubscriptionOverview` ring.
- `src/components/dashboard/index.ts` — re-export `SubscriptionOverview`.
- `src/app/(app)/dashboard/page.tsx` — hero stats read real fields.
- `packages/types/src/index.ts` — optional real-metric fields on `DashboardSummary`.
- `src/lib/legal-corpus/{normalize,corpus,index}.ts` — ingestion pipeline.
- `src/lib/ai/grounding.ts` — corpus hits merged into grounding results.
- `src/app/api/v1/sources/[id]/route.ts` — corpus source resolution.
- `apps/frontend/scripts/ingest-legal-corpus.ts` + `package.json` script.
- `.env.example` — `LEGALIR_LEGAL_CORPUS_PATH` documentation.

### Unchanged (by design)
- Information architecture, auth/OTP, navigation, subscription architecture,
  chat streaming architecture, DB technology (JSON-file DB), and design
  tokens. Existing routes only received minimal additive changes.

---

## Deliverables

| # | Document |
|---|----------|
| 1 | `01_DASHBOARD_METRICS.md` |
| 2 | `02_CORPUS_INGESTION.md` |
| 3 | `03_GROUNDING_INTEGRATION.md` |
| 4 | `04_TESTING.md` |
| 5 | `05_QUALITY_GATE.md` |

---

## Key Design Decisions

- **Asia/Tehran business day** is a fixed UTC+03:30 offset (Iran dropped DST
  in 2022), implemented via `tehranDateString` + `tehranDayStartUtc`.
- **PDFs/DOCX are not parsed** (no native extractor in the dependency set).
  The pipeline honestly SHA-256-fingerprints the real files and maps each to
  hand-curated structured law metadata (`law-catalog.ts`), which is then
  chunked and indexed. No extracted text is invented.
- **Corpus is the indexed artifact**, distinct from the curated catalog; the
  grounding layer merges both, de-duplicating by canonical `lawId`.
