// ============================================================
// LEGALIR — File Upload Adapter Contract
// ============================================================
// Abstracts the file upload transport layer.
// Mock: simulate upload via MSW handler (no real file transfer).
// Production: presigned URL upload to object storage (S3/MinIO)
// with progress tracking and chunked upload support.
// ============================================================

/** Result of a successful file upload. */
export interface FileUploadResult {
  /** Server-assigned document ID */
  documentId: string;
  /** The storage key used by the backend */
  storageKey: string;
  /** Final document status after upload */
  status: string;
}

/** Callbacks for upload progress and lifecycle. */
export interface FileUploadCallbacks {
  /** Called with 0-1 progress (0 = started, 1 = complete). */
  onProgress: (fraction: number) => void;
  /** Called when upload completes successfully. */
  onComplete: (result: FileUploadResult) => void;
  /** Called on any upload error. */
  onError: (error: { code: string; message: string }) => void;
}

/**
 * Abstract file upload adapter.
 *
 * Frontend code depends only on this interface.
 * The production implementation uploads directly to object storage
 * using a presigned URL, then calls the complete-upload endpoint.
 */
export interface FileUploadAdapter {
  /**
   * Upload a file to the backend.
   * @param file - The File object from the browser
   * @param callbacks - Progress and lifecycle callbacks
   * @param signal - Optional AbortSignal for cancellation
   */
  upload(
    file: File,
    callbacks: FileUploadCallbacks,
    signal?: AbortSignal
  ): void;
}
