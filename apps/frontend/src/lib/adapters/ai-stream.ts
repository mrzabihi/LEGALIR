// ============================================================
// LEGALIR — AI Streaming Adapter Contract
// ============================================================
// Abstracts the AI response streaming transport.
// Mock: returns a canned response after a simulated delay.
// Production: connects to SSE/WebSocket endpoint for real-time
// token-by-token streaming from the AI provider.
// ============================================================

/** A single chunk of a streaming AI response. */
export interface AiStreamChunk {
  /** Unique chunk identifier */
  id: string;
  /** The text fragment for this chunk */
  text: string;
  /** Chunk sequence number (0-based) */
  index: number;
  /** Whether this is the final chunk */
  isLast: boolean;
  /** The structured section this chunk belongs to (may be null for preamble) */
  sectionId: string | null;
  /** ISO timestamp */
  timestamp: string;
}

/** Callbacks for consuming a stream. */
export interface AiStreamCallbacks {
  /** Called for each chunk received. */
  onChunk: (chunk: AiStreamChunk) => void;
  /** Called when the stream completes successfully. */
  onComplete: (fullResponse: string, sections: AiStreamChunk[]) => void;
  /** Called on any stream error (network, timeout, server). */
  onError: (error: { code: string; message: string }) => void;
}

/**
 * Abstract AI streaming adapter.
 *
 * Frontend code depends only on this interface.
 * At init time, the correct implementation is injected
 * based on environment (mock vs. real).
 */
export interface AiStreamAdapter {
  /**
   * Begin streaming an AI response for the given message.
   * Returns an AbortController-compatible signal to cancel.
   */
  stream(
    conversationId: string,
    messageId: string,
    callbacks: AiStreamCallbacks,
    signal?: AbortSignal
  ): void;
}
