// ============================================================
// LEGALIR — Legal Corpus barrel
// ============================================================
export {
  CORPUS_VERSION,
  MAX_LAW_FILE_BYTES,
  chunkText,
  ingestCorpus,
  readCorpus,
  retrieveCorpus,
  defaultCorpusDir,
  storeLawFile,
} from "./corpus";
export type {
  CorpusChunk,
  CorpusFailure,
  CorpusSource,
  CorpusIndex,
  CorpusHit,
  IngestReport,
  StoredLawFile,
} from "./corpus";
export { normalizePersian, tokenize } from "./normalize";
