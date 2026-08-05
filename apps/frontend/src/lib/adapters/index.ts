// ============================================================
// LEGALIR — Adapter Boundary Exports
// ============================================================
// Each adapter defines an abstract contract (interface)
// that the frontend codes against. Production implementations
// are swapped in at app initialization when apiMode ≠ "mock".
// ============================================================

export type { AiStreamAdapter, AiStreamChunk } from "./ai-stream";
export type { FileUploadAdapter, FileUploadResult } from "./file-upload";
export type { DocumentStatusPoller, DocumentStatusSnapshot } from "./document-polling";
export type { ContractGenerator, ContractGenerationResult } from "./contract-generator";
export type { AuthTokenManager, TokenStore } from "./auth-tokens";
