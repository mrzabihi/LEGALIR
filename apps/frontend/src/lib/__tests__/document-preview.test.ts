// ============================================================
// LEGALIR — Document preview detection tests
// ============================================================
// The detection helper is the single decision point for "can we
// preview this?", shared by the server route and the client. These
// tests pin the MIME-first / extension-fallback contract.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  detectPreviewKind,
  effectiveMime,
  fileExtension,
  previewContentType,
  previewTypeLabel,
} from "../document-preview";

describe("fileExtension", () => {
  it("returns the lower-cased extension", () => {
    expect(fileExtension("Report.PDF")).toBe("pdf");
    expect(fileExtension("photo.JPEG")).toBe("jpeg");
  });

  it("ignores query strings and fragments", () => {
    expect(fileExtension("scan.png?v=2")).toBe("png");
    expect(fileExtension("scan.webp#page")).toBe("webp");
  });

  it("returns empty for names without an extension", () => {
    expect(fileExtension("README")).toBe("");
    expect(fileExtension("trailing.")).toBe("");
  });
});

describe("effectiveMime", () => {
  it("trusts a supported reported MIME", () => {
    expect(effectiveMime("application/pdf", "file.bin")).toBe("application/pdf");
    expect(effectiveMime("image/webp", "file.bin")).toBe("image/webp");
  });

  it("strips MIME parameters", () => {
    expect(effectiveMime("application/pdf; charset=utf-8", "x.pdf")).toBe("application/pdf");
  });

  it("falls back to the extension when the MIME is generic", () => {
    expect(effectiveMime("application/octet-stream", "scan.jpg")).toBe("image/jpeg");
    expect(effectiveMime("", "scan.png")).toBe("image/png");
  });

  it("prefers the extension over an unsupported MIME", () => {
    expect(effectiveMime("text/plain", "contract.pdf")).toBe("application/pdf");
  });
});

describe("detectPreviewKind", () => {
  it("detects PDFs by MIME", () => {
    expect(detectPreviewKind("application/pdf", "anything")).toBe("pdf");
  });

  it("detects PDFs by extension when the MIME is missing", () => {
    expect(detectPreviewKind("", "قرارداد.pdf")).toBe("pdf");
  });

  it("detects every supported image type", () => {
    expect(detectPreviewKind("image/jpeg", "a.jpg")).toBe("image");
    expect(detectPreviewKind("image/png", "a.png")).toBe("image");
    expect(detectPreviewKind("image/webp", "a.webp")).toBe("image");
  });

  it("detects images by extension when the MIME is generic", () => {
    expect(detectPreviewKind("application/octet-stream", "check.jpeg")).toBe("image");
  });

  it("marks DOCX as unsupported", () => {
    expect(
      detectPreviewKind(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "صورتجلسه.docx"
      )
    ).toBe("unsupported");
  });

  it("marks unknown types as unsupported", () => {
    expect(detectPreviewKind("application/zip", "archive.zip")).toBe("unsupported");
    expect(detectPreviewKind("", "no-extension")).toBe("unsupported");
  });
});

describe("previewContentType", () => {
  it("returns the resolved MIME for inline serving", () => {
    expect(previewContentType("application/pdf", "x.pdf")).toBe("application/pdf");
    expect(previewContentType("", "x.png")).toBe("image/png");
  });

  it("falls back to octet-stream when nothing is known", () => {
    expect(previewContentType("", "mystery")).toBe("application/octet-stream");
  });
});

describe("previewTypeLabel", () => {
  it("labels PDFs and images", () => {
    expect(previewTypeLabel("application/pdf", "x.pdf")).toBe("PDF");
    expect(previewTypeLabel("image/png", "x.png")).toBe("PNG");
    expect(previewTypeLabel("image/webp", "x.webp")).toBe("WEBP");
    expect(previewTypeLabel("image/jpeg", "x.jpg")).toBe("JPEG");
  });

  it("falls back to the upper-cased extension for unsupported types", () => {
    expect(previewTypeLabel("application/zip", "archive.zip")).toBe("ZIP");
  });
});

