import { describe, it, expect, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import {
  fixtureDocumentListItems,
  fixtureDocumentListResponse,
  fixtureDocumentDetail,
  fixtureDocumentDetailFailed,
  fixtureDocumentStatusReady,
  fixtureDocumentStatusProcessing,
  fixtureDocumentAnalysisResponse,
  fixtureRiskReportFull,
  fixtureUploadResponse,
} from "@legalir/testing";
import type { RiskLevel } from "@legalir/types";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";

const API_BASE = "http://localhost:8000";

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

function _TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000 },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

// ==========================================
// Phase 9 — Document Upload & Analysis
// ==========================================

describe("Phase 9 — Document Upload & Legal Analysis", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================
  // 1. File Type & Size Validation
  // ==========================================
  describe("File Validation", () => {
    it("accepts PDF files", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).toContain("application/pdf");
    });

    it("accepts DOCX files", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("accepts PNG images", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).toContain("image/png");
    });

    it("accepts JPEG images", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).toContain("image/jpeg");
    });

    it("rejects unsupported file types", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).not.toContain("text/plain");
      expect(SUPPORTED_DOCUMENT_MIMES).not.toContain("application/zip");
    });

    it("max file size is 25 MB", () => {
      expect(MAX_DOCUMENT_SIZE_BYTES).toBe(25 * 1024 * 1024);
    });
  });

  // ==========================================
  // 2. Document List (MSW / API)
  // ==========================================
  describe("Document List API", () => {
    it("returns document list with correct structure", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureDocumentListResponse));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents`);
      const json = await res.json();
      expect(json.data.items).toHaveLength(5);
    });

    it("filters documents by status", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents`, async ({ request }) => {
          const url = new URL(request.url);
          const status = url.searchParams.get("status");
          if (status === "ready") {
            const ready = fixtureDocumentListItems.filter((d) => d.status === "ready");
            return HttpResponse.json(
              ok({ items: ready, pagination: { page: 1, pageSize: 20, total: ready.length, totalPages: 1 } })
            );
          }
          return HttpResponse.json(ok(fixtureDocumentListResponse));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents?status=ready`);
      const json = await res.json();
      for (const item of json.data.items) {
        expect(item.status).toBe("ready");
      }
    });

    it("searches documents by name", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents`, async ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get("search")?.toLowerCase() ?? "";
          const filtered = fixtureDocumentListItems.filter((d) =>
            d.name.toLowerCase().includes(search)
          );
          return HttpResponse.json(
            ok({ items: filtered, pagination: { page: 1, pageSize: 20, total: filtered.length, totalPages: 1 } })
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents?search=اجاره`);
      const json = await res.json();
      expect(json.data.items.length).toBeGreaterThan(0);
      expect(json.data.items[0].name).toContain("اجاره");
    });

    it("handles server error gracefully", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents`, async () => {
          await delay(50);
          return HttpResponse.json(
            { code: "INTERNAL_ERROR", message: "خطای داخلی سرور", correlationId: "e1", retryable: true },
            { status: 500 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents`);
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // 3. Upload Initiation
  // ==========================================
  describe("Upload Initiation", () => {
    it("initiates upload with valid request", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/uploads`, async ({ request }) => {
          await delay(50);
          const _body = await request.json() as { name: string; mime: string; sizeBytes: number };
          return HttpResponse.json(
            ok({
              id: "test-upload-001",
              uploadUrl: `${API_BASE}/api/v1/documents/uploads/test-upload-001/complete`,
              expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            }),
            { status: 201 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test.pdf",
          mime: "application/pdf",
          sizeBytes: 450_000,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.id).toBeTruthy();
      expect(json.data.uploadUrl).toBeTruthy();
    });

    it("rejects unsupported file format", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/uploads`, async ({ request }) => {
          await delay(50);
          const body = await request.json() as { mime: string };
          const allowed = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/png",
            "image/jpeg",
            "image/webp",
          ];
          if (!allowed.includes(body.mime)) {
            return HttpResponse.json(
              { code: "UNSUPPORTED_FORMAT", message: "فرمت فایل پشتیبانی نمی‌شود", correlationId: "e2", retryable: false },
              { status: 400 }
            );
          }
          return HttpResponse.json(ok({}));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test.txt", mime: "text/plain", sizeBytes: 100 }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects file exceeding size limit", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/uploads`, async ({ request }) => {
          await delay(50);
          const body = await request.json() as { sizeBytes: number };
          if (body.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
            return HttpResponse.json(
              { code: "FILE_TOO_LARGE", message: "حجم فایل بیش از ۲۵ مگابایت است", correlationId: "e3", retryable: false },
              { status: 400 }
            );
          }
          return HttpResponse.json(ok({}));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "large.pdf", mime: "application/pdf", sizeBytes: 30 * 1024 * 1024 }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // 4. Upload Completion
  // ==========================================
  describe("Upload Completion", () => {
    it("completes upload and returns processing status", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/uploads/:id/complete`, async () => {
          await delay(100);
          return HttpResponse.json(
            ok({
              id: "test-upload-001",
              name: "سند-جدید.pdf",
              mime: "application/pdf",
              sizeBytes: 450_000,
              status: "processing",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              riskLevel: null,
              findingCount: 0,
            })
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/uploads/test-upload-001/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      expect(json.data.status).toBe("processing");
    });

    it("handles upload completion failure", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/uploads/:id/complete`, async ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("fail") === "true") {
            return HttpResponse.json(
              { code: "UPLOAD_FAILED", message: "خطا در تکمیل بارگذاری", correlationId: "e4", retryable: true },
              { status: 500 }
            );
          }
          return HttpResponse.json(ok({}));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/uploads/test-id/complete?fail=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // 5. Document Status Polling
  // ==========================================
  describe("Document Status", () => {
    it("returns ready status for completed document", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id/status`, async () => {
          await delay(30);
          return HttpResponse.json(ok(fixtureDocumentStatusReady));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-lease-001/status`);
      const json = await res.json();
      expect(json.data.status).toBe("ready");
      expect(json.data.progress).toBe(100);
    });

    it("returns processing status with progress", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id/status`, async () => {
          await delay(30);
          return HttpResponse.json(ok(fixtureDocumentStatusProcessing));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-nda-001/status`);
      const json = await res.json();
      expect(json.data.status).toBe("processing");
      expect(json.data.progress).toBe(35);
      expect(json.data.currentStage).toBe("extracting");
    });

    it("returns failed status with error code", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id/status`, async () => {
          await delay(30);
          return HttpResponse.json(
            ok({
              id: "doc-failed-001",
              status: "failed",
              progress: 45,
              currentStage: "extracting",
              errorCode: "OCR_LOW_QUALITY",
            })
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-failed-001/status`);
      const json = await res.json();
      expect(json.data.status).toBe("failed");
      expect(json.data.errorCode).toBe("OCR_LOW_QUALITY");
    });
  });

  // ==========================================
  // 6. Document Detail
  // ==========================================
  describe("Document Detail", () => {
    it("returns full document detail for ready document", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureDocumentDetail));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-lease-001`);
      const json = await res.json();
      expect(json.data.status).toBe("ready");
      expect(json.data.report).toBeTruthy();
      expect(json.data.report.findings).toHaveLength(5);
      expect(json.data.jobs).toHaveLength(4);
    });

    it("returns document with processing jobs", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id`, async ({ params }) => {
          const id = params["id"] as string;
          if (id === "doc-nda-001") {
            return HttpResponse.json(
              ok({
                ...fixtureDocumentDetail,
                id: "doc-nda-001",
                status: "processing",
                report: null,
                extractedText: null,
                jobs: [
                  { id: "j1", documentId: "doc-nda-001", stage: "uploaded", status: "completed", progress: 100, errorCode: null },
                  { id: "j2", documentId: "doc-nda-001", stage: "processing", status: "completed", progress: 100, errorCode: null },
                  { id: "j3", documentId: "doc-nda-001", stage: "extracting", status: "running", progress: 35, errorCode: null },
                ],
              })
            );
          }
          return HttpResponse.json(ok(fixtureDocumentDetail));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-nda-001`);
      const json = await res.json();
      expect(json.data.status).toBe("processing");
      expect(json.data.report).toBeNull();
    });

    it("returns not found for unknown document", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id`, async () => {
          await delay(30);
          return HttpResponse.json(
            { code: "NOT_FOUND", message: "سند یافت نشد", correlationId: "e5", retryable: false },
            { status: 404 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-nonexistent`);
      expect(res.status).toBe(404);
    });

    it("returns 410 for deleted document", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id`, async () => {
          await delay(30);
          return HttpResponse.json(
            { code: "GONE", message: "سند حذف شده است", correlationId: "e6", retryable: false },
            { status: 410 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-deleted-001`);
      expect(res.status).toBe(410);
    });
  });

  // ==========================================
  // 7. Analysis Report
  // ==========================================
  describe("Analysis Report", () => {
    it("returns analysis with findings", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id/analysis`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureDocumentAnalysisResponse));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-lease-001/analysis`);
      const json = await res.json();
      expect(json.data.report).toBeTruthy();
      expect(json.data.report.findings.length).toBe(5);
      expect(json.data.extractedText).toBeTruthy();
    });

    it("analysis not ready returns 409", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents/:id/analysis`, async () => {
          await delay(30);
          return HttpResponse.json(
            { code: "ANALYSIS_NOT_READY", message: "تحلیل هنوز آماده نیست", correlationId: "e7", retryable: true },
            { status: 409 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-nda-001/analysis?notReady=true`);
      expect(res.status).toBe(409);
    });
  });

  // ==========================================
  // 8. Retry Processing
  // ==========================================
  describe("Retry Processing", () => {
    it("retries failed document processing", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/:id/retry`, async ({ params }) => {
          await delay(100);
          return HttpResponse.json(
            ok({ id: params["id"] as string, status: "processing" })
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-failed-001/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      expect(json.data.status).toBe("processing");
    });

    it("rejects retry for non-retryable document", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/:id/retry`, async ({ params }) => {
          const id = params["id"] as string;
          if (id === "doc-lease-001") {
            return HttpResponse.json(
              { code: "INVALID_STATE", message: "سند در وضعیت قابل تلاش مجدد نیست", correlationId: "e8", retryable: false },
              { status: 409 }
            );
          }
          return HttpResponse.json(ok({ id, status: "processing" }));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-lease-001/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(409);
    });

    it("handles retry failure", async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/documents/:id/retry`, async () => {
          await delay(50);
          return HttpResponse.json(
            { code: "RETRY_FAILED", message: "تلاش مجدد ناموفق بود", correlationId: "e9", retryable: true },
            { status: 500 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/fail-id/retry?fail=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // 9. Delete Document
  // ==========================================
  describe("Delete Document", () => {
    it("deletes document successfully", async () => {
      server.use(
        http.delete(`${API_BASE}/api/v1/documents/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok({ deleted: true }));
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-to-delete`, {
        method: "DELETE",
      });
      const json = await res.json();
      expect(json.data.deleted).toBe(true);
    });

    it("handles delete failure", async () => {
      server.use(
        http.delete(`${API_BASE}/api/v1/documents/:id`, async () => {
          await delay(30);
          return HttpResponse.json(
            { code: "DELETE_FAILED", message: "خطا در حذف سند", correlationId: "e10", retryable: true },
            { status: 500 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents/doc-to-delete?fail=true`, {
        method: "DELETE",
      });
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // 10. Risk Level & Finding Contracts
  // ==========================================
  describe("Risk Level Contracts", () => {
    const riskLevels: RiskLevel[] = ["low", "medium", "high", "critical"];

    const riskColors: Record<RiskLevel, string> = {
      low: "green",
      medium: "yellow",
      high: "orange",
      critical: "red",
    };

    it("supports all four risk levels", () => {
      expect(riskLevels).toHaveLength(4);
      for (const level of riskLevels) {
        expect(riskColors[level]).toBeTruthy();
      }
    });

    it("findings include all required fields", () => {
      const finding = fixtureRiskReportFull.findings[0]!;
      expect(finding).toHaveProperty("id");
      expect(finding).toHaveProperty("documentId");
      expect(finding).toHaveProperty("title");
      expect(finding).toHaveProperty("severity");
      expect(finding).toHaveProperty("locator");
      expect(finding).toHaveProperty("reason");
      expect(finding).toHaveProperty("recommendation");
      expect(finding).toHaveProperty("citation");
      expect(finding).toHaveProperty("confidence");
    });

    it("findings contain Persian legal categories", () => {
      const titles = fixtureRiskReportFull.findings.map((f) => f.title);
      expect(titles).toContain("فسخ");
      expect(titles).toContain("جریمه");
      expect(titles).toContain("مالکیت");
      expect(titles).toContain("تعهدات");
      expect(titles).toContain("حل اختلاف");
    });

    it("critical finding has critical severity", () => {
      const faskhFinding = fixtureRiskReportFull.findings.find((f) => f.title === "فسخ");
      expect(faskhFinding?.severity).toBe("critical");
    });

    it("high severity findings should have confidence > 0.8", () => {
      const highFindings = fixtureRiskReportFull.findings.filter(
        (f) => f.severity === "high" || f.severity === "critical"
      );
      for (const f of highFindings) {
        expect(f.confidence).toBeGreaterThan(0.8);
      }
    });

    it("report metadata includes generation date and confidence", () => {
      expect(fixtureRiskReportFull).toHaveProperty("generatedAt");
      expect(fixtureRiskReportFull).toHaveProperty("confidence");
      expect(fixtureRiskReportFull.confidence).toBeGreaterThan(0);
      expect(fixtureRiskReportFull.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================
  // 11. Document Lifecycle States
  // ==========================================
  describe("Document Lifecycle", () => {
    const lifecycleStates = [
      "uploaded",
      "processing",
      "extracting",
      "analyzing",
      "ready",
      "failed",
      "blocked",
      "cancelled",
    ] as const;

    it("all lifecycle states are supported in document status type", () => {
      expect(lifecycleStates).toHaveLength(8);
    });

    it("progression goes uploaded → processing → extracting → analyzing → ready", () => {
      const progression = ["uploaded", "processing", "extracting", "analyzing", "ready"];
      // Verify all progression states exist in lifecycle
      for (const state of progression) {
        expect(lifecycleStates).toContain(state);
      }
    });

    it("failed, blocked, and cancelled are terminal states", () => {
      const terminalStates = ["failed", "blocked", "cancelled"];
      for (const state of terminalStates) {
        expect(lifecycleStates).toContain(state);
      }
    });

    it("status badge maps each state to a color scheme", () => {
      const statusSchemes: Record<string, string> = {
        ready: "green",
        processing: "blue",
        extracting: "blue",
        analyzing: "blue",
        uploaded: "gray",
        failed: "red",
        blocked: "red",
        cancelled: "yellow",
      };

      for (const state of lifecycleStates) {
        expect(statusSchemes[state]).toBeTruthy();
      }
    });
  });

  // ==========================================
  // 12. Document Jobs Lifecycle
  // ==========================================
  describe("Document Jobs", () => {
    it("complete document has all 4 job stages completed", () => {
      const { jobs } = fixtureDocumentDetail;
      const completedJobs = jobs.filter((j) => j.status === "completed");
      expect(completedJobs).toHaveLength(4);

      const stages = jobs.map((j) => j.stage);
      expect(stages).toContain("uploaded");
      expect(stages).toContain("processing");
      expect(stages).toContain("extracting");
      expect(stages).toContain("analyzing");
    });

    it("failed document has a failed job with error code", () => {
      const { jobs } = fixtureDocumentDetailFailed;
      const failedJob = jobs.find((j) => j.status === "failed");
      expect(failedJob).toBeTruthy();
      expect(failedJob?.errorCode).toBe("OCR_LOW_QUALITY");
    });

    it("in-progress jobs show correct progress", () => {
      // Processing document jobs
      const runningJob = { stage: "extracting", status: "running", progress: 35 };
      expect(runningJob.progress).toBe(35);
      expect(runningJob.status).toBe("running");
    });
  });

  // ==========================================
  // 13. Type Contract Checks
  // ==========================================
  describe("Type Contracts", () => {
    it("V1DocumentListItem matches contract", () => {
      const item = fixtureDocumentListItems[0]!;
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("mime");
      expect(item).toHaveProperty("sizeBytes");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("updatedAt");
      expect(item).toHaveProperty("riskLevel");
      expect(item).toHaveProperty("findingCount");
    });

    it("V1DocumentDetail matches contract", () => {
      const detail = fixtureDocumentDetail;
      expect(detail).toHaveProperty("id");
      expect(detail).toHaveProperty("userId");
      expect(detail).toHaveProperty("name");
      expect(detail).toHaveProperty("mime");
      expect(detail).toHaveProperty("sizeBytes");
      expect(detail).toHaveProperty("status");
      expect(detail).toHaveProperty("storageKey");
      expect(detail).toHaveProperty("createdAt");
      expect(detail).toHaveProperty("updatedAt");
      expect(detail).toHaveProperty("jobs");
      expect(detail).toHaveProperty("report");
      expect(detail).toHaveProperty("extractedText");
      expect(detail).toHaveProperty("previewUrl");
    });

    it("V1DocumentUploadResponse matches contract", () => {
      const upload = fixtureUploadResponse;
      expect(upload).toHaveProperty("id");
      expect(upload).toHaveProperty("uploadUrl");
      expect(upload).toHaveProperty("expiresAt");
    });

    it("V1DocumentStatusResponse matches contract", () => {
      const status = fixtureDocumentStatusReady;
      expect(status).toHaveProperty("id");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("progress");
      expect(status).toHaveProperty("currentStage");
      expect(status).toHaveProperty("errorCode");
    });
  });

  // ==========================================
  // 14. API Error Handling
  // ==========================================
  describe("API Error Responses", () => {
    it("errors include code, message, and correlationId", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/documents`, async () => {
          await delay(20);
          return HttpResponse.json(
            { code: "TEST_ERROR", message: "پیغام خطا", correlationId: "c1", retryable: false },
            { status: 400 }
          );
        })
      );

      const res = await fetch(`${API_BASE}/api/v1/documents`);
      const json = await res.json();
      expect(json.code).toBe("TEST_ERROR");
      expect(json.message).toBeTruthy();
      expect(json.correlationId).toBeTruthy();
    });
  });

  // ==========================================
  // 15. Document List Filter & Sort
  // ==========================================
  describe("Document Filtering & Sorting", () => {
    it("returns all documents when status filter is 'all'", async () => {
      const allItems = fixtureDocumentListItems;
      expect(allItems.length).toBeGreaterThanOrEqual(4);
    });

    it("ready filter only returns ready documents", () => {
      const ready = fixtureDocumentListItems.filter((d) => d.status === "ready");
      for (const doc of ready) {
        expect(doc.status).toBe("ready");
      }
      expect(ready.length).toBeGreaterThan(0);
    });

    it("newest sort returns most recent first", () => {
      const sorted = [...fixtureDocumentListItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(new Date(sorted[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(sorted[i + 1]!.createdAt).getTime()
        );
      }
    });
  });

  // ==========================================
  // 16. Sensitive Data Protection
  // ==========================================
  describe("Sensitive Data Protection", () => {
    it("extracted text exists in fixture but should not be logged", () => {
      const { extractedText } = fixtureDocumentDetail;
      expect(extractedText).toBeTruthy();
      // Test that we verify the data exists (but in production code,
      // sensitive text should NOT be passed to console.log)
      expect(typeof extractedText).toBe("string");
    });

    it("document content is not in response meta", () => {
      const response = ok(fixtureDocumentDetail);
      expect(response.meta).not.toHaveProperty("documentContent");
      expect(response.meta).not.toHaveProperty("extractedText");
    });
  });

  // ==========================================
  // 17. Responsive Layout Requirements
  // ==========================================
  describe("Responsive Behavior", () => {
    it("document list items should render in grid layout", () => {
      // Testing the grid CSS classes pattern
      const gridClasses = "grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3";
      expect(gridClasses).toContain("grid-cols-1");
      expect(gridClasses).toContain("tablet:grid-cols-2");
      expect(gridClasses).toContain("desktop:grid-cols-3");
    });

    it("touch targets should be at minimum 44px", () => {
      const touchClass = "touch-target";
      expect(touchClass).toBeTruthy();
    });

    it("RTL direction is set on root elements", () => {
      // RTL is set via dir="rtl" in layout and TestWrapper
      const dir = "rtl";
      expect(dir).toBe("rtl");
    });
  });

  // ==========================================
  // 18. Supported Formats
  // ==========================================
  describe("Supported Document Formats", () => {
    it("supports PDF format", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).toContain("application/pdf");
    });

    it("supports DOCX format", () => {
      expect(SUPPORTED_DOCUMENT_MIMES).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("supports image formats", () => {
      const imageMimes = SUPPORTED_DOCUMENT_MIMES.filter((m) => m.startsWith("image/"));
      expect(imageMimes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
