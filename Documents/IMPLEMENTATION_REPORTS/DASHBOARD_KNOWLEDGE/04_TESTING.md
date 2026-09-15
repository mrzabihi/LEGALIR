# Testing

## New unit tests

### `src/lib/__tests__/legal-corpus.test.ts` (12 tests)

- **normalizePersian** — Arabic→Persian glyph unification, kashida/hamza
  removal, Persian + Arabic-Indic digit conversion, whitespace collapse.
- **tokenize** — stopword/number removal, empty-input handling.
- **chunkText** — single short chunk, multi-chunk split with upper bound.
- **ingestCorpus** — curated-file mapping (`lawId`, `VERIFIED_OFFICIAL`),
  dedup by SHA-256, unmapped-file `DEMO_VERIFIED`.
- **retrieveCorpus** — matching Persian query surfaces the ingested source;
  no-overlap query returns `[]`.

### `src/lib/__tests__/dashboard-metrics.test.ts` (5 tests)

- **tehranDayStartUtc / tehranDayEndUtc** — UTC instant of Tehran midnight,
  24h span, stability within a day, midnight boundary rollover, fixed
  `+03:30` offset (no DST).

## How to run

```bash
# Frontend unit tests (full suite)
npm run test -w apps/frontend

# Targeted
npx vitest run src/lib/__tests__/legal-corpus.test.ts
npx vitest run src/lib/__tests__/dashboard-metrics.test.ts
```

## Verified

- `legal-corpus.test.ts` — 12/12 pass.
- `dashboard-metrics.test.ts` — 5/5 pass.

The corpus test caught and led to a fix for a real defect in
`normalizeDigit` (spurious `0` for removed kashida/hamza characters).
