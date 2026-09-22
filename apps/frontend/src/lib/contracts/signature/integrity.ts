// ============================================================
// LEGALIR — Version integrity verification
// ============================================================
// Before a signature is recorded, the version's hash is RECOMPUTED
// from its stored snapshot and compared with the hash recorded when
// the version was created. A mismatch means the stored snapshot was
// altered after the fact, and the signature is refused.
//
// This is the tamper-evidence half of the versioning rule: a
// signature binds to a hash, and the hash is re-proved at sign time.
// ============================================================

import type { PropertyContractVersion } from "@legalir/types";
import { hashSnapshot } from "../snapshot";

export interface IntegrityResult {
  ok: boolean;
  /** The hash recomputed from the stored snapshot. */
  recomputed: string;
  /** The hash recorded on the version row. */
  recorded: string;
}

/**
 * Recompute a version's hash from its snapshot and compare it with the
 * recorded hash. Pure — no I/O — so it is directly testable.
 */
export function verifyVersionIntegrity(version: PropertyContractVersion): IntegrityResult {
  const recomputed = hashSnapshot(version.snapshot);
  return {
    ok: recomputed === version.documentHash,
    recomputed,
    recorded: version.documentHash,
  };
}
