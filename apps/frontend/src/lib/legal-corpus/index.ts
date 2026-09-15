// ============================================================
// LEGALIR — Legal Corpus barrel
// ============================================================
export {
  CORPUS_VERSION,
  chunkText,
  ingestCorpus,
  readCorpus,
  retrieveCorpus,
  defaultCorpusDir,
} from "./corpus";
export type {
  CorpusChunk,
  CorpusSource,
  CorpusIndex,
  CorpusHit,
  IngestReport,
} from "./corpus";
export { normalizePersian, tokenize } from "./normalize";
