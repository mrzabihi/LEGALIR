// ============================================================
// LEGALIR — Persian text normalization & tokenization (pure)
// ============================================================
// Dependency-free, deterministic helpers used by the legal corpus
// ingestion pipeline. Kept free of fs/crypto so it can be unit-tested
// and reused on both the ingest CLI and retrieval path.
// ============================================================

// Arabic/Persian character normalization map.
const CHAR_NORMALIZE: Record<string, string> = {
  "\u064A": "\u06CC", // ي → ی
  "\u0649": "\u06CC", // ى → ی
  "\u0643": "\u06A9", // ك → ک
  "\u06AB": "\u06A9", // ګ → ک
  "\u0629": "\u0647", // ة → ه
  "\u0623": "\u0627", // أ → ا
  "\u0625": "\u0627", // إ → ا
  "\u0622": "\u0627", // آ → ا
  "\u0621": "", // ء (hamza) → remove
  "\u0640": "", // tatweel/kashida → remove
  "\u200D": "\u200C", // ZWJ → ZWNJ
  "\u200E": "", // LRM → remove
  "\u200F": "", // RLM → remove
  "\u00A0": " ", // NBSP → space
};

const PERSIAN_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"; // ۰-۹
const ARABIC_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"; // ٠-٩

function normalizeChar(ch: string): string {
  return CHAR_NORMALIZE[ch] ?? ch;
}

/** Convert Persian/Arabic-Indic digits to ASCII 0-9. */
function normalizeDigit(ch: string): string {
  if (!ch) return ch;
  const pi = PERSIAN_DIGITS.indexOf(ch);
  if (pi !== -1) return String(pi);
  const ai = ARABIC_DIGITS.indexOf(ch);
  if (ai !== -1) return String(ai);
  return ch;
}

/**
 * Canonicalize Persian legal text: unify Arabic/Persian glyphs, convert
 * digits, strip kashida/hamza, collapse whitespace, and lower-case any
 * embedded Latin tokens.
 */
export function normalizePersian(text: string): string {
  let out = "";
  for (const ch of text) {
    out += normalizeDigit(normalizeChar(ch));
  }
  return out.replace(/\s+/g, " ").trim().toLowerCase();
}

// Persian legal stopwords (short, high-frequency words that add no
// discrimination for retrieval).
const STOPWORDS = new Set([
  "و", "در", "از", "به", "با", "برای", "که", "این", "آن", "را", "است",
  "هست", "می", "شود", "باشد", "من", "تو", "او", "ما", "شما", "چگونه",
  "چه", "چیست", "لطفا", "لطفاً", "کند", "کنم", "دارم", "هستم", "آیا",
  "نیز", "هر", "یا", "تا", "بر", "خود", "اگر", "پس", "ان", "ها", "های",
  "یک", "دو", "سه", "the", "of", "and", "for", "in", "to", "a", "an",
]);

/**
 * Tokenize normalized Persian text into lowercase keyword tokens.
 * Only letters (Persian + Latin) are kept; numbers are dropped because
 * article numbers are better handled as structured locators.
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/[0-9]+/g, " ")
    .replace(/[^\u0600-\u06FFa-z\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
