# Grounding + Sources Integration

## Purpose

Make the ingested corpus surface as citable chat references, and make those
reference ids resolvable by the chat «مستندات»/«ارجاعات» tabs.

## `src/lib/ai/grounding.ts`

`retrieveGroundedSources(query, maxSources)` already returned library sources
and the 16 curated `LAW_SOURCES` matches. It now also merges hits from
`retrieveCorpus(query, maxSources)`:

- Each `CorpusHit` is mapped to a `GroundedSource` using `hit.source.lawId` as
  the canonical id when present, otherwise the corpus `source.id`.
- Hits whose canonical id is already present (already surfaced by the catalog
  law or library match) are skipped, avoiding duplicate references.
- Unmatched files (no catalog entry, e.g. the `.docx` variants) surface as
  their own citable source, so the ingested corpus is never dropped.
- `sourceType` is mapped through the existing `SOURCE_TYPE_MAP`.

The `contextBlock` (injected into the system prompt) and the persisted
`V1Reference[]` continue to be built from the merged `sources`, so a corpus
citation gets a real `locator` (article section) and verbatim-ish quote.

## `src/app/api/v1/sources/[id]/route.ts`

Added a third resolution branch after the law catalog and legal library:

- `readCorpus().sources.find((s) => s.id === id)` resolves `corpus-<hash12>`
  ids (and any `lawId` fallback the client already resolves via branch 1).
- New `corpusSourceToV1SourceDetail(s)` maps a `CorpusSource` to the Phase-8
  `V1SourceDetail` shape, with `status` derived by `toSourceStatus` and
  `documentIdentifier` set to the original file name.

Resolution order is unchanged for existing ids: catalog → library → corpus.

## Call chain

```
POST /api/v1/ai/stream
  → retrieveGroundedSources(content, 3)
      → readLegalLibrary()          (existing)
      → LAW_SOURCES match            (existing)
      → retrieveCorpus(query, 3)     (new — ingested corpus)
  → system prompt contextBlock + references persisted on the assistant message

GET /api/v1/sources/[id]
  → getLawById(id)                   (existing)
  → readLegalLibrary().details[id]   (existing)
  → readCorpus().sources.find(...)   (new)
```
