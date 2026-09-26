// ============================================================
// LEGALIR — Document preview component tests
// ============================================================
// Covers the preview card's three real states (PDF, image,
// unsupported) and the viewer's dispatch. pdf.js is mocked — the
// point here is the wiring and the states, not canvas rasterisation.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import React from "react";
import { server } from "@/mocks/server";

import { DocumentPreviewCard } from "../document-preview-card";
import { DocumentViewer } from "../document-viewer";

const API_BASE = "http://localhost:8000";

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

// pdf.js is heavy and canvas-based; stub the loader so the card can
// render its thumbnail branch without a real PDF.
vi.mock("@/lib/pdf", () => ({
  loadPdfjs: vi.fn(() =>
    Promise.resolve({
      GlobalWorkerOptions: { workerSrc: "" },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 3,
          getPage: () =>
            Promise.resolve({
              getViewport: ({ scale }: { scale: number }) => ({
                width: 600 * scale,
                height: 800 * scale,
              }),
              render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
            }),
          destroy: () => undefined,
        }),
      }),
    })
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "doc-lease-001" }),
  usePathname: () => "/documents/doc-lease-001",
}));

let queryClient: QueryClient;

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
});

afterEach(() => {
  server.resetHandlers();
});

/** Override the preview endpoint with a specific descriptor. */
function mockPreview(descriptor: Record<string, unknown>) {
  server.use(
    http.get(`${API_BASE}/api/v1/documents/:id/preview`, async () => {
      await delay(10);
      return HttpResponse.json(ok(descriptor));
    })
  );
}

// ============================================================
// DocumentPreviewCard
// ============================================================

describe("DocumentPreviewCard", () => {
  it("shows a skeleton while the descriptor loads", () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "قرارداد.pdf",
      mime: "application/pdf",
      sizeBytes: 1000,
      kind: "pdf",
      fileUrl: "/api/v1/documents/doc-lease-001/file",
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: true,
    });

    render(
      <TestWrapper>
        <DocumentPreviewCard
          documentId="doc-lease-001"
          fileName="قرارداد.pdf"
          mime="application/pdf"
          sizeBytes={1000}
        />
      </TestWrapper>
    );

    expect(screen.getByText("پیش‌نمایش سند")).toBeInTheDocument();
    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
  });

  it("renders a clickable card with file name, type and size for a PDF", async () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "قرارداد-اجاره.pdf",
      mime: "application/pdf",
      sizeBytes: 153_952,
      kind: "pdf",
      fileUrl: "/api/v1/documents/doc-lease-001/file",
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: true,
    });

    render(
      <TestWrapper>
        <DocumentPreviewCard
          documentId="doc-lease-001"
          fileName="قرارداد-اجاره.pdf"
          mime="application/pdf"
          sizeBytes={153_952}
        />
      </TestWrapper>
    );

    const link = await screen.findByRole("link", { name: /مشاهده کامل/ });
    expect(link).toHaveAttribute("href", "/documents/doc-lease-001/preview");
    expect(screen.getByText("قرارداد-اجاره.pdf")).toBeInTheDocument();
    expect(screen.getByText(/PDF •/)).toBeInTheDocument();
  });

  it("renders the real image for an image document", async () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "تصویر-چک.jpg",
      mime: "image/jpeg",
      sizeBytes: 1_240_000,
      kind: "image",
      fileUrl: "/api/v1/documents/doc-lease-001/file",
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: true,
    });

    render(
      <TestWrapper>
        <DocumentPreviewCard
          documentId="doc-lease-001"
          fileName="تصویر-چک.jpg"
          mime="image/jpeg"
          sizeBytes={1_240_000}
        />
      </TestWrapper>
    );

    const img = await screen.findByRole("img", { name: "تصویر-چک.jpg" });
    expect(img).toHaveAttribute("src", "/api/v1/documents/doc-lease-001/file");
    expect(screen.getByText(/JPEG •/)).toBeInTheDocument();
  });

  it("falls back to the unsupported state for DOCX", async () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "صورتجلسه.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 88_000,
      kind: "unsupported",
      fileUrl: null,
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: false,
    });

    render(
      <TestWrapper>
        <DocumentPreviewCard
          documentId="doc-lease-001"
          fileName="صورتجلسه.docx"
          mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          sizeBytes={88_000}
        />
      </TestWrapper>
    );

    expect(
      await screen.findByText("پیش‌نمایش این نوع فایل در حال حاضر پشتیبانی نمی‌شود.")
    ).toBeInTheDocument();
    // No viewer link for an unsupported type.
    expect(screen.queryByRole("link", { name: /مشاهده کامل/ })).not.toBeInTheDocument();
  });

  it("shows a missing-file error (not unsupported) when a supported type has no bytes", async () => {
    mockPreview({
      documentId: "doc-rent-001",
      name: "قرارداد-اجاره-مسکونی.pdf",
      mime: "application/pdf",
      sizeBytes: 120_000,
      kind: "pdf",
      fileUrl: null,
      downloadUrl: "/api/v1/documents/doc-rent-001/download",
      available: false,
    });

    render(
      <TestWrapper>
        <DocumentPreviewCard
          documentId="doc-rent-001"
          fileName="قرارداد-اجاره-مسکونی.pdf"
          mime="application/pdf"
          sizeBytes={120_000}
        />
      </TestWrapper>
    );

    expect(await screen.findByText("فایل این سند در دسترس نیست.")).toBeInTheDocument();
    // Must NOT be mistaken for an unsupported file type.
    expect(
      screen.queryByText("پیش‌نمایش این نوع فایل در حال حاضر پشتیبانی نمی‌شود.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("دانلود فایل")).toBeInTheDocument();
  });

  it("shows a Persian error state with retry when the descriptor fails", async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/documents/:id/preview`, async () => {
        await delay(10);
        return HttpResponse.json(
          { code: "NOT_FOUND", message: "سند یافت نشد" },
          { status: 404 }
        );
      })
    );

    render(
      <TestWrapper>
        <DocumentPreviewCard
          documentId="doc-lease-001"
          fileName="قرارداد.pdf"
          mime="application/pdf"
          sizeBytes={1000}
        />
      </TestWrapper>
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("پیش‌نمایش فایل بارگذاری نشد.")).toBeInTheDocument();
    expect(screen.getByText("تلاش دوباره")).toBeInTheDocument();
    expect(screen.getByText("دانلود فایل")).toBeInTheDocument();
  });
});

// ============================================================
// DocumentViewer
// ============================================================

describe("DocumentViewer", () => {
  it("renders the PDF viewer with pagination and zoom controls", async () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "قرارداد.pdf",
      mime: "application/pdf",
      sizeBytes: 1000,
      kind: "pdf",
      fileUrl: "/api/v1/documents/doc-lease-001/file",
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: true,
    });

    render(
      <TestWrapper>
        <DocumentViewer
          documentId="doc-lease-001"
          fileName="قرارداد.pdf"
          mime="application/pdf"
          sizeBytes={1000}
        />
      </TestWrapper>
    );

    await waitFor(() =>
      expect(screen.getByRole("toolbar", { name: "ابزارهای نمایش PDF" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "صفحه بعد" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "صفحه قبل" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "بزرگ‌نمایی" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "کوچک‌نمایی" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تناسب با عرض" })).toBeInTheDocument();
  });

  it("renders the image viewer with zoom controls", async () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "چک.png",
      mime: "image/png",
      sizeBytes: 2000,
      kind: "image",
      fileUrl: "/api/v1/documents/doc-lease-001/file",
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: true,
    });

    render(
      <TestWrapper>
        <DocumentViewer
          documentId="doc-lease-001"
          fileName="چک.png"
          mime="image/png"
          sizeBytes={2000}
        />
      </TestWrapper>
    );

    await waitFor(() =>
      expect(screen.getByRole("toolbar", { name: "ابزارهای نمایش تصویر" })).toBeInTheDocument()
    );
    expect(screen.getByRole("img", { name: "چک.png" })).toBeInTheDocument();
  });

  it("renders the unsupported state for DOCX", async () => {
    mockPreview({
      documentId: "doc-lease-001",
      name: "صورتجلسه.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 88_000,
      kind: "unsupported",
      fileUrl: null,
      downloadUrl: "/api/v1/documents/doc-lease-001/download",
      available: false,
    });

    render(
      <TestWrapper>
        <DocumentViewer
          documentId="doc-lease-001"
          fileName="صورتجلسه.docx"
          mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          sizeBytes={88_000}
        />
      </TestWrapper>
    );

    expect(
      await screen.findByText("پیش‌نمایش این نوع فایل در حال حاضر پشتیبانی نمی‌شود.")
    ).toBeInTheDocument();
  });

  it("shows a missing-file error for a supported type with no bytes", async () => {
    mockPreview({
      documentId: "doc-rent-001",
      name: "قرارداد-اجاره-مسکونی.pdf",
      mime: "application/pdf",
      sizeBytes: 120_000,
      kind: "pdf",
      fileUrl: null,
      downloadUrl: "/api/v1/documents/doc-rent-001/download",
      available: false,
    });

    render(
      <TestWrapper>
        <DocumentViewer
          documentId="doc-rent-001"
          fileName="قرارداد-اجاره-مسکونی.pdf"
          mime="application/pdf"
          sizeBytes={120_000}
        />
      </TestWrapper>
    );

    expect(await screen.findByText("فایل این سند در دسترس نیست.")).toBeInTheDocument();
    expect(screen.getByText("دانلود فایل")).toBeInTheDocument();
  });

  it("shows a not-found state for an unauthorized document", async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/documents/:id/preview`, async () => {
        await delay(10);
        return HttpResponse.json(
          { code: "NOT_FOUND", message: "سند یافت نشد" },
          { status: 404 }
        );
      })
    );

    render(
      <TestWrapper>
        <DocumentViewer
          documentId="someone-elses-doc"
          fileName="محرمانه.pdf"
          mime="application/pdf"
          sizeBytes={1000}
        />
      </TestWrapper>
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("سند یافت نشد")).toBeInTheDocument();
    expect(
      screen.getByText("این سند وجود ندارد یا به حساب شما تعلق ندارد.")
    ).toBeInTheDocument();
    // No download offered for a document the user cannot access.
    expect(screen.queryByText("دانلود فایل")).not.toBeInTheDocument();
  });
});
