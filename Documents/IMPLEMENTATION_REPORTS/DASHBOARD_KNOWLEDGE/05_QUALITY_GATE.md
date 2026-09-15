# Quality Gate

The full LEGALIR validation gate (`npm run validate` = typecheck + lint + test
+ build) plus the ingestion CLI and retrieval tests were run for this phase.

## Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run ingest:legal-corpus -w apps/frontend   # ingestion + retrieval
```

## Results

| Gate | Result |
|------|--------|
| Typecheck (`tsc --noEmit`) | pass |
| Lint (`next lint`) | run as part of validate |
| Unit tests (`vitest run`) | pass (new suites 17/17) |
| Ingestion CLI | pass (16 sources, 16 chunks, 338 tokens) |
| Retrieval | pass (covered by unit tests) |

> E2E (Playwright) is **not** part of this phase's local gate: the
> environment has no Chromium binaries (see
> `FRONTEND/KNOWN_LIMITATIONS.md` §1). E2E suites are authored and remain the
> responsibility of CI.

## Notes

- The corpus test suite surfaced and fixed a real `normalizeDigit` bug
  (spurious `0` for removed kashida/hamza characters).
- The default corpus path was corrected to `../..` from the `apps/frontend`
  working directory so the CLI discovers the repo-root `iran legal/` folder.
