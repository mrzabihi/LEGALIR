// ============================================================
// LEGALIR — Ingest Legal Corpus CLI
// ============================================================
// Run via `npm run ingest:legal-corpus`. Bundles this TS file with
// esbuild (already a dependency) into a temp CJS file and runs it,
// so no separate TS runner is required.
//
// Discovers the official law files (default: ../iran legal, or
// LEGALIR_LEGAL_CORPUS_PATH), hashes/dedups them, and writes the
// searchable corpus to .data/legal-corpus.json.
// ============================================================

import { ingestCorpus, defaultCorpusDir } from "../src/lib/legal-corpus";

const corpusDir = process.argv[2] ?? defaultCorpusDir();
const report = ingestCorpus(corpusDir);

// eslint-disable-next-line no-console
console.log("LEGALIR — Legal Corpus ingestion complete");
// eslint-disable-next-line no-console
console.log(JSON.stringify(report, null, 2));
