// ============================================================
// LEGALIR — Document preview capability detection (isomorphic)
// ============================================================
// Decides whether a stored file can be previewed, using the MIME type
// first and the file extension as a fallback (browsers and uploads
// frequently report an empty or generic MIME). Shared by the server
// route that serves the bytes and the client components that render
// them, so both always agree on the same answer.
// ============================================================

import type { DocumentPreviewKind } from "@legalir/types";

export const PDF_MIME = "application/pdf";

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Extension → MIME fallback, used when the reported MIME is unusable. */
const EXTENSION_MIME: Record<string, string> = {
  pdf: PDF_MIME,
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Lower-cased extension of a file name, without the dot. */
export function fileExtension(fileName: string): string {
  const base = fileName.split(/[?#]/)[0] ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/**
 * The effective MIME for a file: the reported MIME when it is one we
 * understand, otherwise the extension-derived MIME, otherwise the
 * reported MIME as-is.
 */
export function effectiveMime(mime: string, fileName: string): string {
  const normalised = (mime ?? "").split(";")[0]!.trim().toLowerCase();
  if (normalised === PDF_MIME || (IMAGE_MIMES as readonly string[]).includes(normalised)) {
    return normalised;
  }
  const fromExtension = EXTENSION_MIME[fileExtension(fileName)];
  return fromExtension ?? normalised;
}

/** Resolve how a file should be previewed. */
export function detectPreviewKind(mime: string, fileName: string): DocumentPreviewKind {
  const resolved = effectiveMime(mime, fileName);
  if (resolved === PDF_MIME) return "pdf";
  if ((IMAGE_MIMES as readonly string[]).includes(resolved)) return "image";
  return "unsupported";
}

/** The Content-Type to send when serving the file inline. */
export function previewContentType(mime: string, fileName: string): string {
  const resolved = effectiveMime(mime, fileName);
  return resolved || "application/octet-stream";
}

/** A short Persian label for the file type, shown on the preview card. */
export function previewTypeLabel(mime: string, fileName: string): string {
  const kind = detectPreviewKind(mime, fileName);
  if (kind === "pdf") return "PDF";
  if (kind === "image") {
    const resolved = effectiveMime(mime, fileName);
    if (resolved === "image/png") return "PNG";
    if (resolved === "image/webp") return "WEBP";
    return "JPEG";
  }
  const ext = fileExtension(fileName);
  return ext ? ext.toUpperCase() : "فایل";
}
