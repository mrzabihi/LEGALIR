# DEMO CONTENT — Cross-Resource Relationship Map (ارتباطات)

Seven deterministic relationship edges link the demo persona's documents,
contracts, memories and conversations into one coherent legal story for
**امیر رضایی**.

The data model is `DemoRelationship` in `src/lib/demo-seed.ts`:

```ts
interface DemoRelationship {
  id: string;
  userId: string;
  sourceType: "document" | "contract" | "memory" | "conversation";
  sourceId: string;
  targetType: "document" | "contract" | "memory" | "conversation";
  targetId: string;
  relation: string;   // e.g. "generated-from", "analyzed-in", "references"
  relationFa: string;
}
```

## Edge list (`.data/relationships.json`)

| id | source → target | relation | meaning |
|----|-----------------|----------|---------|
| `rel-001` | contract `cnt-emp-001` → document `doc-emp-001` | `generated-from` | قرارداد استخدام از سند کار تولید شده است |
| `rel-002` | document `doc-emp-001` → conversation `conv-demo-001` | `analyzed-in` | سند کار در گفتگو تحلیل شده است |
| `rel-003` | contract `cnt-ctr-001` → document `doc-ctr-001` | `generated-from` | قرارداد پیمانکاری از سند تولید شده است |
| `rel-004` | document `doc-ctr-001` → conversation `conv-demo-002` | `analyzed-in` | سند پیمانکاری در گفتگو تحلیل شده است |
| `rel-005` | memory `mem-004` → contract `cnt-emp-001` | `references` | حافظه «قراردادهای فعال» به قرارداد استخدام اشاره می‌کند |
| `rel-006` | memory `mem-005` → contract `cnt-ctr-001` | `references` | حافظه «پرونده جاری» به قرارداد پیمانکاری اشاره می‌کند |
| `rel-007` | contract `cnt-nda-001` → document `doc-nda-001` | `generated-from` | توافقنامه محرمانگی از سند NDA تولید شده است |

## Traversal (بازخوانی داستان)

1. **Employment lifecycle** — `doc-emp-001` (قرارداد کار، ۴ صفحه PDF) is analyzed
   in `conv-demo-001`; the analysis drives `cnt-emp-001` (قرارداد استخدام، ۳ نسخه
   with salary negotiation) — linked by `rel-002` + `rel-001`.
2. **Contracting lifecycle** — `doc-ctr-001` (پیمانکاری) analyzed in
   `conv-demo-002`, generating `cnt-ctr-001` (SLA tightening across versions) —
   linked by `rel-004` + `rel-003`.
3. **NDA lifecycle** — `doc-nda-001` → `cnt-nda-001` (`rel-007`).
4. **Memory recall** — the memory items `mem-004` and `mem-005` point back into
   the contract store (`rel-005`, `rel-006`), demonstrating that the assistant
   can surface «قراردادهای فعال» and the ongoing «پرونده جاری» from memory.

## Source/target coverage

- **sourceType**: contract (3), document (2), memory (2).
- **targetType**: document (3), conversation (2), contract (2).

## Persistence

Written by `seedDemoContent` via `writeTable<DemoRelationship>("relationships", …)`
and read back with `listDemoRelationships(userId)` (optionally filtered by
`sourceType` / `sourceId`). Stored in `.data/relationships.json`, rewritten
atomically on `DEMO_SEED_VERSION` mismatch.
