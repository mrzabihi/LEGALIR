// ============================================================
// LEGALIR — Document Status Polling Adapter Contract
// ============================================================
// Abstracts how document processing status is polled.
// Mock: useQuery with refetchInterval (already implemented).
// Production: may use WebSocket or long-polling for real-time
// status updates during document analysis pipeline.
// ============================================================

/** A snapshot of the current document processing status. */
export interface DocumentStatusSnapshot {
  documentId: string;
  status: string;
  progress: number; // 0-100
  currentStage: string | null;
  errorCode: string | null;
}

/** Callbacks for status polling lifecycle. */
export interface DocumentPollingCallbacks {
  /** Called on each status update. */
  onStatus: (snapshot: DocumentStatusSnapshot) => void;
  /** Called when processing reaches a terminal state (ready/failed/blocked/cancelled). */
  onComplete: (snapshot: DocumentStatusSnapshot) => void;
  /** Called on polling errors (network timeout, etc.). */
  onError: (error: { code: string; message: string }) => void;
}

/**
 * Abstract document status polling adapter.
 *
 * Frontend code depends only on this interface.
 * The mock implementation uses React Query refetchInterval
 * against the MSW handler. Production may use WebSocket events
 * or Server-Sent Events for lower latency.
 */
export interface DocumentStatusPoller {
  /**
   * Start polling for document status until terminal state.
   * @returns A cleanup function to stop polling.
   */
  start(
    documentId: string,
    callbacks: DocumentPollingCallbacks,
    intervalMs?: number
  ): () => void;
}
