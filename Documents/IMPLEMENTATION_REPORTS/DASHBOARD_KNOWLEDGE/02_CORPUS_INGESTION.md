# Local Legal Knowledge Ingestion

## Purpose

Turn the 16 official law files under `iran legal/` into a searchable, citable
corpus persisted at `.data/legal-corpus.json`, without adding any native
PDF/DOCX parsing dependency.

## Pipeline

```
discover → validate → hash(dedup) → map metadata → normalize → chunk → inverted-index → persist
```

## Files

- `src/lib/legal-corpus/normalize.ts` — pure Persian normalization/tokenization.
- `src/lib/legal-corpus/corpus.ts` — discovery, hashing, mapping, chunking,
  indexing, retrieval.
- `src/lib/legal-corpus/index.ts` — barrel re-export.
- `apps/frontend/scripts/ingest-legal-corpus.ts` — CLI entrypoint.
- `apps/frontend/package.json` — `ingest:legal-corpus` script (esbuild-bundled).

## Normalization (`normalize.ts`)

- Unifies Arabic/Persian glyphs (`ي→ی`, `ك→ک`, `ة→ه`, `أ/إ/آ→ا`).
- Removes hamza (`ء`) and kashida/tatweel (`ـ`) characters.
- Converts Persian (`۰-۹`) and Arabic-Indic (`٠-٩`) digits to ASCII.
- Collapses whitespace and lowercases embedded Latin.
- `tokenize` drops numbers and Persian/English stopwords, keeping letter-only
  keyword tokens.

**Bug fixed during testing:** `normalizeDigit` previously returned `"0"` for the
empty string (because `"".indexOf("") === 0`), so every removed kashida/hamza
emitted a spurious `0`. A `!ch` guard now short-circuits removed characters.

## Ingestion (`corpus.ts`)

- `discover(dir)` lists `*.pdf`, `*.docx`, `*.txt`, reads raw bytes, and
  computes a SHA-256 fingerprint for each.
- `ingestCorpus(dir)` dedups identical files by hash, then maps each file name
  (normalized) to its curated entry in `law-catalog.ts`:
  - matched → `verificationStatus = "VERIFIED_OFFICIAL"`, `lawId = curated.id`;
  - unmatched → `verificationStatus = "DEMO_VERIFIED"`, `lawId = null`.
- Searchable text is the curated structured fields (`title`, `articleSection`,
  `excerpt`, `summary`, `keywords`).
- `chunkText(text, 900, 120)` splits into sentence-boundary-aware chunks with
  overlap.
- `buildInvertedIndex` maps each token to the chunk ids containing it.
- The resulting `CorpusIndex` is written to `.data/legal-corpus.json`.

### Honesty note

PDF/DOCX binaries are **not** parsed. The pipeline fingerprints the real files
and maps them to hand-curated structured metadata. No extracted text is
fabricated. Retrieval therefore cites the curated provision text, not invented
page content.

## CLI

```bash
npm run ingest:legal-corpus
```

- Default corpus dir: `LEGALIR_LEGAL_CORPUS_PATH` env var, else
  `path.resolve(process.cwd(), "..", "..", "iran legal")` — i.e. the repo-root
  `iran legal/` folder when run from `apps/frontend`.
- Accepts an optional positional dir override: `node … "D:/path/to/corpus"`.
- Prints a JSON `IngestReport` (`discovered`, `duplicatesSkipped`, `sources`,
  `chunks`, `tokens`, `output`).

### Verified result

```
discovered: 16, duplicatesSkipped: 0, sources: 16, chunks: 16, tokens: 338
```

## Retrieval

- `retrieveCorpus(query, maxResults=3)` tokenizes + normalizes the query,
  scores chunks by token overlap against the inverted index, and returns
  `CorpusHit[]` (`{ chunkId, source, locator, excerpt, score }`).
- `readCorpus()` lazy-ingests on first access if the file is missing or has a
  stale `CORPUS_VERSION`.
