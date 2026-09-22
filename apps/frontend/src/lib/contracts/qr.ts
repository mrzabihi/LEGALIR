// ============================================================
// LEGALIR — Minimal QR encoder (byte mode, ECC level L)
// ============================================================
// The finalized contract PDF carries a QR code pointing at the
// public verification page. No QR dependency is installed, so this
// module implements the encoder directly: byte mode, error
// correction level L, versions 1–10 (up to 271 bytes — far more than
// a verification URL needs).
//
// `qrMatrix(text)` returns a square boolean matrix where `true` is a
// dark module. The caller renders it as SVG or draws it into a PDF.
// ============================================================

// ------------------------------------------------------------
// GF(256) arithmetic for Reed–Solomon
// ------------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

/** The Reed–Solomon generator polynomial of degree `n`. */
function rsGenerator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] = (next[j] ?? 0) ^ (g[j] ?? 0);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(g[j] ?? 0, EXP[i] ?? 0);
    }
    g = next;
  }
  return g;
}

/** The `n` ECC codewords for a data block. */
function rsRemainder(data: number[], gen: number[]): number[] {
  const res = new Array<number>(gen.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0]!;
    res.shift();
    res.push(0);
    for (let i = 0; i < res.length; i++) {
      res[i] = (res[i] ?? 0) ^ gfMul(gen[i + 1] ?? 0, factor);
    }
  }
  return res;
}

// ------------------------------------------------------------
// Version tables (ECC level L)
// ------------------------------------------------------------

interface VersionSpec {
  /** Total codewords in the symbol. */
  totalCodewords: number;
  /** ECC codewords per block. */
  ecPerBlock: number;
  /** [blockCount, dataCodewordsPerBlock] for each group. */
  groups: [number, number][];
  /** Alignment pattern centre coordinates. */
  alignment: number[];
}

const VERSIONS: Record<number, VersionSpec> = {
  1: { totalCodewords: 26, ecPerBlock: 7, groups: [[1, 19]], alignment: [] },
  2: { totalCodewords: 44, ecPerBlock: 10, groups: [[1, 34]], alignment: [6, 18] },
  3: { totalCodewords: 70, ecPerBlock: 15, groups: [[1, 55]], alignment: [6, 22] },
  4: { totalCodewords: 100, ecPerBlock: 20, groups: [[1, 80]], alignment: [6, 26] },
  5: { totalCodewords: 134, ecPerBlock: 26, groups: [[1, 108]], alignment: [6, 30] },
  6: { totalCodewords: 172, ecPerBlock: 18, groups: [[2, 68]], alignment: [6, 34] },
  7: { totalCodewords: 196, ecPerBlock: 20, groups: [[2, 78]], alignment: [6, 22, 38] },
  8: { totalCodewords: 242, ecPerBlock: 24, groups: [[2, 97]], alignment: [6, 24, 42] },
  9: { totalCodewords: 292, ecPerBlock: 30, groups: [[2, 116]], alignment: [6, 26, 46] },
  10: { totalCodewords: 346, ecPerBlock: 18, groups: [[2, 68], [2, 69]], alignment: [6, 28, 50] },
};

/** Version information bit strings for versions 7–10. */
const VERSION_INFO: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

/** Total data codewords for a version. */
function dataCodewordCount(spec: VersionSpec): number {
  return spec.groups.reduce((acc, [count, per]) => acc + count * per, 0);
}

/** The smallest version that fits `byteLength` bytes in byte mode. */
function pickVersion(byteLength: number): number {
  for (let v = 1; v <= 10; v++) {
    const spec = VERSIONS[v]!;
    const countBits = v <= 9 ? 8 : 16;
    const capacityBits = dataCodewordCount(spec) * 8 - 4 - countBits;
    if (byteLength * 8 <= capacityBits) return v;
  }
  throw new Error("QR payload too large for the supported versions");
}

// ------------------------------------------------------------
// Bit stream
// ------------------------------------------------------------

class BitBuffer {
  readonly bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

/** Encode `text` into the interleaved codeword sequence. */
function encodeCodewords(text: string, version: number): number[] {
  const spec = VERSIONS[version]!;
  const bytes = Array.from(new TextEncoder().encode(text));
  const dataCodewords = dataCodewordCount(spec);

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // byte mode
  buffer.put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) buffer.put(b, 8);

  // Terminator, then pad to a byte boundary.
  const capacityBits = dataCodewords * 8;
  const terminator = Math.min(4, capacityBits - buffer.bits.length);
  buffer.put(0, terminator);
  while (buffer.bits.length % 8 !== 0) buffer.bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j]!;
    dataBytes.push(byte);
  }
  // Pad bytes alternate 0xEC / 0x11.
  let pad = 0xec;
  while (dataBytes.length < dataCodewords) {
    dataBytes.push(pad);
    pad = pad === 0xec ? 0x11 : 0xec;
  }

  // Split into blocks, compute ECC, then interleave.
  const gen = rsGenerator(spec.ecPerBlock);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const [count, per] of spec.groups) {
    for (let i = 0; i < count; i++) {
      const block = dataBytes.slice(offset, offset + per);
      offset += per;
      dataBlocks.push(block);
      ecBlocks.push(rsRemainder(block, gen));
    }
  }

  const result: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]!);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i]!);
    }
  }
  return result;
}

// ------------------------------------------------------------
// Matrix construction
// ------------------------------------------------------------

interface Matrix {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];
}

function emptyMatrix(size: number): Matrix {
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    isFunction: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function setFunction(m: Matrix, row: number, col: number, dark: boolean): void {
  m.modules[row]![col] = dark;
  m.isFunction[row]![col] = true;
}

/** Draw a 7×7 finder pattern with its separator at (row, col). */
function drawFinder(m: Matrix, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= m.size || cc < 0 || cc >= m.size) continue;
      const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark =
        inRing &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setFunction(m, rr, cc, dark);
    }
  }
}

/** Draw a 5×5 alignment pattern centred at (row, col). */
function drawAlignment(m: Matrix, row: number, col: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      setFunction(m, row + r, col + c, dark);
    }
  }
}

function drawFunctionPatterns(m: Matrix, version: number): void {
  const spec = VERSIONS[version]!;

  // Timing patterns.
  for (let i = 0; i < m.size; i++) {
    setFunction(m, 6, i, i % 2 === 0);
    setFunction(m, i, 6, i % 2 === 0);
  }

  // Finder patterns + separators.
  drawFinder(m, 0, 0);
  drawFinder(m, 0, m.size - 7);
  drawFinder(m, m.size - 7, 0);

  // Alignment patterns (skip the three finder corners).
  const positions = spec.alignment;
  for (const r of positions) {
    for (const c of positions) {
      const nearFinder =
        (r <= 8 && c <= 8) ||
        (r <= 8 && c >= m.size - 9) ||
        (r >= m.size - 9 && c <= 8);
      if (nearFinder) continue;
      drawAlignment(m, r, c);
    }
  }

  // Reserve the format information areas.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunction(m, 8, i, false);
      setFunction(m, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunction(m, 8, m.size - 1 - i, false);
    setFunction(m, m.size - 1 - i, 8, false);
  }
  setFunction(m, m.size - 8, 8, true); // dark module

  // Version information for versions 7+.
  if (version >= 7) {
    const bits = VERSION_INFO[version]!;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = i % 3;
      setFunction(m, m.size - 11 + b, a, bit);
      setFunction(m, a, m.size - 11 + b, bit);
    }
  }
}

/** Place the codeword bits in the standard zigzag order. */
function placeData(m: Matrix, codewords: number[]): void {
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  }

  let index = 0;
  let upward = true;
  for (let col = m.size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1; // skip the vertical timing column
    for (let i = 0; i < m.size; i++) {
      const row = upward ? m.size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (m.isFunction[row]![c]) continue;
        m.modules[row]![c] = index < bits.length ? bits[index] === 1 : false;
        index += 1;
      }
    }
    upward = !upward;
  }
}

/** Apply a mask pattern to every non-function module. */
function applyMask(m: Matrix, mask: number): void {
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (m.isFunction[r]![c]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
        case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
      }
      if (invert) m.modules[r]![c] = !m.modules[r]![c];
    }
  }
}

/** The 15-bit format information for ECC level L and a mask. */
function formatBits(mask: number): number {
  const data = (0b01 << 3) | mask; // L = 01
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(m: Matrix, mask: number): void {
  const bits = formatBits(mask);
  for (let i = 0; i <= 5; i++) setFunction(m, 8, i, ((bits >>> i) & 1) === 1);
  setFunction(m, 8, 7, ((bits >>> 6) & 1) === 1);
  setFunction(m, 8, 8, ((bits >>> 7) & 1) === 1);
  setFunction(m, 7, 8, ((bits >>> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) setFunction(m, 14 - i, 8, ((bits >>> i) & 1) === 1);

  for (let i = 0; i < 8; i++) {
    setFunction(m, m.size - 1 - i, 8, ((bits >>> i) & 1) === 1);
  }
  for (let i = 8; i < 15; i++) {
    setFunction(m, 8, m.size - 15 + i, ((bits >>> i) & 1) === 1);
  }
  setFunction(m, m.size - 8, 8, true);
}

/** Penalty score used to pick the least-noisy mask. */
function penalty(m: Matrix): number {
  const size = m.size;
  let score = 0;

  // Rule 1 — runs of five or more same-coloured modules.
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (m.modules[r]![c] === m.modules[r]![c - 1]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (m.modules[r]![c] === m.modules[r - 1]![c]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  }

  // Rule 2 — 2×2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m.modules[r]![c];
      if (
        v === m.modules[r]![c + 1] &&
        v === m.modules[r + 1]![c] &&
        v === m.modules[r + 1]![c + 1]
      ) {
        score += 3;
      }
    }
  }

  // Rule 3 — finder-like 1:1:3:1:1 patterns.
  const pattern = [true, false, true, true, true, false, true];
  const matches = (get: (i: number) => boolean, start: number): boolean => {
    for (let i = 0; i < 7; i++) if (get(start + i) !== pattern[i]) return false;
    return true;
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 7; c++) {
      if (matches((i) => m.modules[r]![i]!, c)) score += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 7; r++) {
      if (matches((i) => m.modules[i]![c]!, r)) score += 40;
    }
  }

  // Rule 4 — dark-module balance.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m.modules[r]![c]) dark += 1;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Encode `text` as a QR code and return the module matrix.
 * `true` is a dark module; the matrix is square and includes the
 * quiet zone-free symbol only (callers add their own margin).
 */
export function qrMatrix(text: string): boolean[][] {
  const byteLength = new TextEncoder().encode(text).length;
  const version = pickVersion(byteLength);
  const codewords = encodeCodewords(text, version);

  let best: Matrix | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const m = emptyMatrix(17 + 4 * version);
    drawFunctionPatterns(m, version);
    placeData(m, codewords);
    applyMask(m, mask);
    drawFormatBits(m, mask);
    const score = penalty(m);
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best!.modules;
}

/** Render the matrix as an SVG path string (one sub-path per dark module). */
export function qrSvgPath(matrix: boolean[][], moduleSize = 4, margin = 4): string {
  const size = matrix.length;
  const parts: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!matrix[r]![c]) continue;
      const x = (c + margin) * moduleSize;
      const y = (r + margin) * moduleSize;
      parts.push(`M${x} ${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`);
    }
  }
  return parts.join("");
}
