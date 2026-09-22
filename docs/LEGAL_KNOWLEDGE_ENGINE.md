# LEGALIER — Legal Knowledge Engine

The engine that decides **which legal sources an answer may cite**, **how
authoritative each one is**, and **what the model must do when nothing can be
cited**. It sits behind Stage 3 (RESEARCH) of the [Legal Intelligence
Pipeline](./LEGAL_CHAT_PIPELINE.md).

> The engine never invents a source. If nothing matches, it returns an empty
> list and the answer contract forbids citation outright.

---

## 1. Architecture

```
User question
    │
    ▼
retrieveHybrid(query, maxSources)          lib/knowledge/retriever.ts
    │
    ├─ Pass 1  Legal Library   readLegalLibrary()   .data/legal-library.json
    ├─ Pass 2  Law Catalog     LAW_SOURCES          lib/law-catalog.ts
    └─ Pass 3  Ingested Corpus retrieveCorpus()     .data/legal-corpus.json
    │
    ▼  fuse lexical + authority + verification + validity + popularity
    │
RetrievalHit[]  (ranked, each with full provenance)
    │
    ▼
buildAnswerContract(hits)                  lib/knowledge/answer-contract.ts
    │
    ├─ grounded   → contextBlock + instructionBlock
    └─ ungrounded → NO_CITATION_RULE
    │
    ▼
retrieveGroundedSources()                  lib/ai/grounding.ts
    │
    ▼
System prompt of POST /api/v1/ai/stream    app/api/v1/ai/stream/route.ts
```

| Module | Responsibility |
|--------|----------------|
| `lib/knowledge/authority.ts` | Tier derivation, ranking, weights |
| `lib/knowledge/retriever.ts` | Persian tokenizer + hybrid fusion |
| `lib/knowledge/answer-contract.ts` | Context/instruction blocks + no-citation rule |
| `lib/ai/grounding.ts` | Adapter into the AI pipeline |
| `app/api/v1/admin/knowledge/route.ts` | Staff inventory API |
| `app/(app)/admin/knowledge/page.tsx` | Staff inventory surface |

Domain types live in `@legalir/types`: `AuthorityTier`, `SourceProvenance`,
`RetrievalHit`, `AnswerContract`, `KnowledgeInventoryItem`,
`KnowledgeInventoryResponse`.

---

## 2. Authority hierarchy

Not every source carries the same weight. When two sources disagree, the
higher tier wins; when two are equally relevant, the higher tier ranks first.

| Rank | Tier | Persian | Weight | Derived from |
|------|------|---------|--------|--------------|
| 1 | `CONSTITUTION` | قانون اساسی | 6 | title/authority naming the constitution |
| 2 | `STATUTE` | قانون | 5 | `law`, `LAW_ARTICLE` |
| 3 | `REGULATION` | آیین‌نامه | 4 | `regulation`, `directive`, `REGULATION` |
| 4 | `PRECEDENT` | رویه قضایی | 3 | `precedent`, `UNIFICATION_RULING`, `JUDICIAL_DECISION` |
| 5 | `OPINION` | نظر حقوقی | 2 | `opinion`, `LEGAL_GUIDE`, `FAQ`, guides, tools |
| 6 | `USER_DOCUMENT` | سند کاربر | 1 | `user_document` |

**The tier is derived, never stored twice.** `tierForSource({sourceType, title,
authority})` resolves it from the source's own type, so it can never drift out
of sync with the source. The one promotion rule: a source whose title or
authority names the constitution is lifted to `CONSTITUTION` — the catalog
stores it as a `law`, but it is the supreme instrument and must outrank every
ordinary statute.

Two further signals modulate the score:

- **Verification** — `VERIFIED_OFFICIAL` (3) > `VERIFIED_SECONDARY` (2) >
  `DEMO_VERIFIED` (1) > `UNVERIFIED` (0). A verified opinion can beat an
  unverified statute when the lexical match is stronger.
- **Validity** — `valid` (1) > `amended` (0) > `needs_review` (−1) >
  `expired` (−2). An expired source is still citable but must not outrank a
  currently-valid one.

---

## 3. Hybrid retrieval

One retriever, three passes, fused into a single ranked list.

### 3.1 Tokenizer

`tokenizeQuery()` is dependency-free and deterministic: it strips Persian and
ASCII digits, strips Arabic-block punctuation (`، ؛ ؟ ٫ ٬ ٭ ۔` — these live
inside `\u0600-\u06FF` and would otherwise survive), drops non-Arabic glyphs,
removes stopwords, and discards single-character tokens. An all-stopword query
yields no tokens and therefore no hits.

### 3.2 The three passes

| Pass | Source | Origin tag | Notes |
|------|--------|-----------|-------|
| 1 | Legal Library | `LIBRARY` | Curated, verified; carries `popular` |
| 2 | Law Catalog | `CATALOG` | 16 official law files; always `VERIFIED_OFFICIAL` |
| 3 | Ingested Corpus | `CORPUS` | SHA-256 fingerprinted, chunked |

### 3.3 Fusion

The passes are **fused, not concatenated**. A source surfaced by more than one
pass accumulates its lexical score — corroboration is a real relevance signal,
so a law that is both catalogued and ingested ranks above one that is only
catalogued. Candidates are keyed by canonical id (`lawId ?? id`), so the same
law from two passes collapses into one hit.

The fused score:

```
score = lexical × 2 + authority + verification + validity + popularity
```

Ranking is deterministic: **score desc → tier rank asc → title
(`localeCompare("fa")`)**. The result is truncated to `maxSources` (default 3).

### 3.4 Provenance

Every hit carries its provenance so the answer can be audited back to the exact
provision it relied on:

```ts
provenance: {
  origin: "LIBRARY" | "CATALOG" | "CORPUS",
  tier, tierFa, authority, locator,
  verificationStatus, textHash, status,
}
```

---

## 4. Answer contract

The contract is built from the retrieval result and injected into the system
prompt, so the model is told — explicitly and structurally — what it may and
may not cite. It is enforced by the contract, not by hoping the model behaves.

### 4.1 Grounded

When sources were retrieved, the contract carries:

- **`contextBlock`** — a numbered list of the sources, each with its locator,
  authority and tier, plus its excerpt.
- **`instructionBlock`** — the citation rule: cite only from the list above,
  reproduce the source number exactly, express anything outside the list as
  general opinion rather than legal citation, and resolve conflicts in favour
  of the higher tier.
- **`topTier`** — the highest-authority tier among the hits.

### 4.2 The no-citation rule

When **no** citable source was retrieved, the contract is ungrounded and the
instruction block is `NO_CITATION_RULE`, which forbids the model from:

- citing any article, note, ruling or document, or inventing a number for one;
- using phrases like «طبق ماده …» or «بر اساس رأی …»;
- and requires it to say plainly that the answer is **not** grounded in
  verified legal sources and that the user should consult a lawyer before
  formal action.

This is the load-bearing guarantee: an ungrounded answer can never masquerade
as a cited one.

---

## 5. Pipeline wiring

`retrieveGroundedSources(query, maxSources)` in `lib/ai/grounding.ts` is the
adapter. It delegates to `retrieveHybrid`, builds the contract, and maps hits
into the pipeline's `GroundedSource[]` and `V1Reference[]` shapes.

`app/api/v1/ai/stream/route.ts` appends `contract.instructionBlock` to the
system prompt immediately after the context block, so the citation rule always
travels with the sources it governs.

---

## 6. Admin surface

`GET /api/v1/admin/knowledge` (permission `admin:knowledge:read`) returns the
full inventory — every source from both the Legal Library and the ingested
corpus — with its tier, provenance and verification status, plus `byTier` and
`byStatus` roll-ups. It supports `tier`, `sourceType` and `verificationStatus`
filters.

It is **read-only**: the knowledge base is seeded from the official law catalog
and the ingested corpus, so there is no free-form write path.

The staff page at `/admin/knowledge` (client-gated to `ADMIN` / `SUPER_ADMIN` /
`SUPPORT`) renders the inventory with tier badges, a truncated content hash, an
"unverified" filter for finding content that needs review, and a legend
explaining the authority hierarchy.

---

## 7. Tests

`src/lib/__tests__/knowledge-engine.test.ts` — 31 tests across four suites:

| Suite | Covers |
|-------|--------|
| Authority | tier derivation, constitution promotion, ranking, weights, verification/validity |
| Tokenizer | stopwords, digits, Arabic punctuation, single chars, all-stopword queries |
| Hybrid retrieval | fusion/corroboration, authority & verification ranking, expiry penalty, `maxSources`, all three passes, no-invention |
| Answer contract | grounded context/instruction, top-tier selection, no-citation rule |

The three knowledge passes are mocked, so the suite is hermetic — no
`.data/*.json` reads, no filesystem.
