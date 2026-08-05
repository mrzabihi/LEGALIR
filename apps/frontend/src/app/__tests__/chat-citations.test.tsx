import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import {
  fixtureV1References,
  fixtureV1SourceCivil490,
  fixtureV1SourceOutdated,
  fixtureV1SourceUnavailable,
  fixtureV1SourceMojer,
  fixtureV1SourceRegulation,
  fixtureV1SourcePrecedent,
  fixtureV1SourceVersions,
} from "@legalir/testing";
import { SourceDetailDrawer } from "@/components/chat/source-detail-drawer";
import { ReferencesTab } from "@/components/chat/references-tab";
import { SourcesTab } from "@/components/chat/sources-tab";
import { CitationInline } from "@/components/chat/citation-inline";
import { CitationCopyButton } from "@/components/chat/citation-copy-button";
import { SourceCard } from "@/components/chat/source-card";
const API_BASE = "http://localhost:8000";

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

function TestWrapper({ children }: { children: React.ReactNode }) {
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

describe("Phase 8 — Legal References & Citations", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================
  // Citation Inline
  // ==========================================
  describe("Citation Inline", () => {
    it("renders citation badge with locator text", () => {
      const ref = fixtureV1References[0]!;
      const onClick = vi.fn();

      render(
        <TestWrapper>
          <CitationInline reference={ref} onClick={onClick} />
        </TestWrapper>
      );

      expect(screen.getByText(ref.locator)).toBeInTheDocument();
    });

    it("calls onClick when citation is clicked", () => {
      const ref = fixtureV1References[0]!;
      const onClick = vi.fn();

      render(
        <TestWrapper>
          <CitationInline reference={ref} onClick={onClick} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText(ref.locator).closest("button")!);
      expect(onClick).toHaveBeenCalledWith(ref);
    });
  });

  // ==========================================
  // Source Detail Drawer
  // ==========================================
  describe("Source Detail Drawer", () => {
    it("renders nothing when sourceId is null", () => {
      const { container } = render(
        <TestWrapper>
          <SourceDetailDrawer sourceId={null} onClose={vi.fn()} />
        </TestWrapper>
      );

      expect(container.textContent).toBe("");
    });

    it("shows loading state when fetching source", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(500); // Slow response
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("جزئیات منبع")).toBeInTheDocument();
      });
    });

    it("shows source details when data loads", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceVersions));
        })
      );

      const onClose = vi.fn();
      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={onClose}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText(fixtureV1SourceCivil490.title)
        ).toBeInTheDocument();
      });

      // Type badge
      expect(
        screen.getByText(fixtureV1SourceCivil490.sourceTypeFa)
      ).toBeInTheDocument();

      // Metadata
      expect(
        screen.getByText(fixtureV1SourceCivil490.publicationAuthority)
      ).toBeInTheDocument();

      // Close button
      fireEvent.click(screen.getByLabelText("بستن"));
      expect(onClose).toHaveBeenCalled();
    });

    it("shows all source metadata fields", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceVersions));
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("مرجع انتشار")).toBeInTheDocument();
        expect(screen.getByText("حوزه قضایی")).toBeInTheDocument();
        expect(screen.getByText("تاریخ اجرا")).toBeInTheDocument();
        expect(screen.getByText("ماده / بخش")).toBeInTheDocument();
        expect(screen.getByText("شناسه")).toBeInTheDocument();
        expect(screen.getByText("آخرین ویرایش")).toBeInTheDocument();
      });
    });

    it("shows version history when available", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceVersions));
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("تاریخچه ویرایش‌ها")).toBeInTheDocument();
      });

      for (const ver of fixtureV1SourceVersions) {
        expect(
          screen.getByText(`نسخه ${ver.versionDate}`)
        ).toBeInTheDocument();
      }
    });

    it("shows 'source not found' for missing sources", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(
            { code: "NOT_FOUND", message: "منبع یافت نشد", correlationId: "t1", retryable: false },
            { status: 404 }
          );
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-nonexistent"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const elements = screen.getAllByText("منبع یافت نشد");
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("shows outdated source warning", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(
            ok({ ...fixtureV1SourceOutdated, status: "expired", availability: "outdated" })
          );
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok([]));
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-outdated-001"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("منسوخ شده")).toBeInTheDocument();
        expect(
          screen.getByText(/این منبع منسوخ شده/)
        ).toBeInTheDocument();
      });
    });

    it("shows unavailable source state", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(
            { code: "SOURCE_UNAVAILABLE", message: "منبع در دسترس نیست", correlationId: "t2", retryable: true },
            { status: 404 }
          );
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-unavailable-001"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/منبع در دسترس نیست/)).toBeInTheDocument();
      });
    });

    it("shows access denied state", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(
            { code: "ACCESS_DENIED", message: "دسترسی به این منبع محدود شده است", correlationId: "t3", retryable: false },
            { status: 403 }
          );
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-denied-001"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("دسترسی محدود")).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // References Tab
  // ==========================================
  describe("References Tab", () => {
    it("renders all references", () => {
      const onRefClick = vi.fn();
      const onNav = vi.fn();

      render(
        <TestWrapper>
          <ReferencesTab
            references={fixtureV1References}
            onReferenceClick={onRefClick}
            onNavigateToSection={onNav}
          />
        </TestWrapper>
      );

      for (const ref of fixtureV1References) {
        expect(screen.getByText(ref.locator)).toBeInTheDocument();
      }
    });

    it("shows empty state when no references", () => {
      render(
        <TestWrapper>
          <ReferencesTab
            references={[]}
            onReferenceClick={vi.fn()}
            onNavigateToSection={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText("منبعی برای این گفتگو یافت نشد")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(
        <TestWrapper>
          <ReferencesTab
            references={[]}
            isLoading
            onReferenceClick={vi.fn()}
            onNavigateToSection={vi.fn()}
          />
        </TestWrapper>
      );

      // Should have skeleton elements (animate-pulse divs)
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("calls onReferenceClick when 'جزئیات منبع' is clicked", () => {
      const onRefClick = vi.fn();
      const onNav = vi.fn();

      render(
        <TestWrapper>
          <ReferencesTab
            references={fixtureV1References.slice(0, 1)}
            onReferenceClick={onRefClick}
            onNavigateToSection={onNav}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("جزئیات منبع"));
      expect(onRefClick).toHaveBeenCalledWith(fixtureV1References[0]);
    });

    it("calls onNavigateToSection when 'رفتن به بخش' is clicked", () => {
      const onRefClick = vi.fn();
      const onNav = vi.fn();

      render(
        <TestWrapper>
          <ReferencesTab
            references={fixtureV1References.slice(0, 1)}
            onReferenceClick={onRefClick}
            onNavigateToSection={onNav}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("رفتن به بخش"));
      expect(onNav).toHaveBeenCalledWith(fixtureV1References[0]!.section);
    });
  });

  // ==========================================
  // Copy Citation
  // ==========================================
  describe("Citation Copy", () => {
    it("renders copy button with label", () => {
      render(
        <TestWrapper>
          <CitationCopyButton text="ماده ۴۹۰ قانون مدنی" />
        </TestWrapper>
      );

      expect(screen.getByText("کپی")).toBeInTheDocument();
    });

    it("shows 'کپی شد' after copying", async () => {
      render(
        <TestWrapper>
          <CitationCopyButton text="ماده ۴۹۰ قانون مدنی" />
        </TestWrapper>
      );

      const button = screen.getByText("کپی").closest("button")!;

      // mock clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("کپی شد")).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // Source Card
  // ==========================================
  describe("Source Card", () => {
    it("renders all source information", () => {
      render(
        <TestWrapper>
          <SourceCard source={fixtureV1SourceCivil490} />
        </TestWrapper>
      );

      expect(screen.getByText(fixtureV1SourceCivil490.title)).toBeInTheDocument();
      expect(screen.getByText(fixtureV1SourceCivil490.sourceTypeFa)).toBeInTheDocument();
      expect(screen.getByText(fixtureV1SourceCivil490.publicationAuthority)).toBeInTheDocument();
      expect(screen.getByText(fixtureV1SourceCivil490.jurisdiction)).toBeInTheDocument();
    });

    it("shows excerpt text and copy button", () => {
      render(
        <TestWrapper>
          <SourceCard source={fixtureV1SourceCivil490} />
        </TestWrapper>
      );

      expect(screen.getByText(fixtureV1SourceCivil490.excerpt)).toBeInTheDocument();
      expect(screen.getByText("کپی متن")).toBeInTheDocument();
    });

    it("shows outdated warning for expired sources", () => {
      render(
        <TestWrapper>
          <SourceCard
            source={{
              ...fixtureV1SourceOutdated,
              status: "expired",
              availability: "outdated",
            }}
          />
        </TestWrapper>
      );

      expect(screen.getByText("منسوخ شده")).toBeInTheDocument();
      expect(
        screen.getByText(/این منبع منسوخ شده/)
      ).toBeInTheDocument();
    });

    it("shows unverified warning for unverified sources", () => {
      render(
        <TestWrapper>
          <SourceCard
            source={{
              ...fixtureV1SourceCivil490,
              availability: "unverified",
            }}
          />
        </TestWrapper>
      );

      expect(screen.getByText("تأیید نشده")).toBeInTheDocument();
      expect(
        screen.getByText(/اعتبار این منبع هنوز تأیید نشده است/)
      ).toBeInTheDocument();
    });

    it("shows unavailable warning for unavailable sources", () => {
      render(
        <TestWrapper>
          <SourceCard
            source={{
              ...fixtureV1SourceUnavailable,
              status: "needs_review",
              availability: "unavailable",
            }}
          />
        </TestWrapper>
      );

      expect(screen.getByText("در دسترس نیست")).toBeInTheDocument();
      expect(
        screen.getByText(/این منبع در حال حاضر در دسترس نیست/)
      ).toBeInTheDocument();
    });

    it("shows link when URL is available", () => {
      render(
        <TestWrapper>
          <SourceCard source={fixtureV1SourceCivil490} />
        </TestWrapper>
      );

      const link = screen.getByText("لینک منبع");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", fixtureV1SourceCivil490.url);
    });

    it("shows document identifier", () => {
      render(
        <TestWrapper>
          <SourceCard source={fixtureV1SourceCivil490} />
        </TestWrapper>
      );

      expect(
        screen.getByText(fixtureV1SourceCivil490.documentIdentifier!)
      ).toBeInTheDocument();
    });
  });

  // ==========================================
  // Sources Tab
  // ==========================================
  describe("Sources Tab", () => {
    function setupSourceHandlers() {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async ({ params }) => {
          await delay(50);
          const id = params["id"] as string;
          const sourceMap: Record<string, unknown> = {
            "src-law-civil-490": fixtureV1SourceCivil490,
            "src-law-mojer-1376": fixtureV1SourceMojer,
            "src-regulation-building": fixtureV1SourceRegulation,
            "src-precinct-1402135": fixtureV1SourcePrecedent,
          };
          const source = sourceMap[id];
          if (!source) {
            return HttpResponse.json(
              { code: "NOT_FOUND", message: "منبع یافت نشد", correlationId: "t1", retryable: false },
              { status: 404 }
            );
          }
          return HttpResponse.json(ok(source));
        })
      );
    }

    it("shows empty state when no references", () => {
      render(
        <TestWrapper>
          <SourcesTab
            references={[]}
            onSourceClick={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText("منبعی برای این گفتگو یافت نشد")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(
        <TestWrapper>
          <SourcesTab
            references={[]}
            isLoading
            onSourceClick={vi.fn()}
          />
        </TestWrapper>
      );

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("fetches and displays unique sources for given references", async () => {
      setupSourceHandlers();

      const onSourceClick = vi.fn();
      render(
        <TestWrapper>
          <SourcesTab
            references={fixtureV1References}
            onSourceClick={onSourceClick}
          />
        </TestWrapper>
      );

      // Wait for sources to load - should show unique source titles
      await waitFor(() => {
        expect(screen.getByText(fixtureV1SourceCivil490.title)).toBeInTheDocument();
      });

      // Should also show the mojer source (unique)
      expect(screen.getByText(fixtureV1SourceMojer.title)).toBeInTheDocument();
    });

    it("calls onSourceClick when 'جزئیات منبع' is clicked", async () => {
      setupSourceHandlers();

      const onSourceClick = vi.fn();
      render(
        <TestWrapper>
          <SourcesTab
            references={fixtureV1References.slice(0, 1)}
            onSourceClick={onSourceClick}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(fixtureV1SourceCivil490.title)).toBeInTheDocument();
      });

      const detailButtons = screen.getAllByText("جزئیات منبع");
      fireEvent.click(detailButtons[0]!);
      expect(onSourceClick).toHaveBeenCalledWith("src-law-civil-490");
    });

    it("shows ref count for sources with multiple citations", async () => {
      setupSourceHandlers();

      // ref-001 and ref-002 both point to src-law-civil-490 (we'll simulate this)
      const duplicatedRefs = [
        { ...fixtureV1References[0]!, sourceId: "src-law-civil-490" },
        { ...fixtureV1References[0]!, sourceId: "src-law-civil-490", id: "ref-dup" },
        { ...fixtureV1References[1]!, sourceId: "src-law-mojer-1376" },
      ];

      render(
        <TestWrapper>
          <SourcesTab
            references={duplicatedRefs}
            onSourceClick={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const items = screen.getAllByText(/بار ارجاع شده/);
        expect(items).toHaveLength(2);
        expect(items[0]!.textContent).toContain("۲ بار ارجاع شده");
      });
    });
  });

  // ==========================================
  // Mobile Drawer Behavior
  // ==========================================
  describe("Mobile Drawer", () => {
    it("renders close button on source detail drawer for touch target", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok([]));
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText("بستن");
        expect(closeButton).toBeInTheDocument();
        // Ensure touch target size class is present
        expect(closeButton.classList.contains("touch-target")).toBe(true);
      });
    });

    it("has proper aria-modal and dialog role on drawer", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok([]));
        })
      );

      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-label", "جزئیات منبع");
      });
    });

    it("closes drawer when backdrop is clicked", async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/sources/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(fixtureV1SourceCivil490));
        }),
        http.get(`${API_BASE}/api/v1/sources/:id/versions`, async () => {
          await delay(50);
          return HttpResponse.json(ok([]));
        })
      );

      const onClose = vi.fn();
      render(
        <TestWrapper>
          <SourceDetailDrawer
            sourceId="src-law-civil-490"
            onClose={onClose}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Click the backdrop (aria-hidden element before dialog)
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Citation to Section Navigation
  // ==========================================
  describe("Citation Navigation", () => {
    it("ReferencesTab shows both 'جزئیات منبع' and 'رفتن به بخش' buttons", () => {
      render(
        <TestWrapper>
          <ReferencesTab
            references={fixtureV1References.slice(0, 1)}
            onReferenceClick={vi.fn()}
            onNavigateToSection={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText("جزئیات منبع")).toBeInTheDocument();
      expect(screen.getByText("رفتن به بخش")).toBeInTheDocument();
    });

    it("navigates to correct section ID on 'رفتن به بخش' click", () => {
      const onNav = vi.fn();
      render(
        <TestWrapper>
          <ReferencesTab
            references={fixtureV1References.slice(0, 1)}
            onReferenceClick={vi.fn()}
            onNavigateToSection={onNav}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("رفتن به بخش"));
      const firstRef = fixtureV1References[0]!;
      expect(onNav).toHaveBeenCalledWith(firstRef.section);
    });

    it("CitationInline navigates to source on click", () => {
      const ref = fixtureV1References[0]!;
      const onClick = vi.fn();

      render(
        <TestWrapper>
          <CitationInline reference={ref} onClick={onClick} />
        </TestWrapper>
      );

      const button = screen.getByText(ref.locator).closest("button")!;
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledWith(ref);
    });
  });

  // ==========================================
  // Type Contract Validation
  // ==========================================
  describe("Type Contracts", () => {
    it("source detail matches V1SourceDetail contract", () => {
      const source = fixtureV1SourceCivil490;
      expect(source).toHaveProperty("id");
      expect(source).toHaveProperty("sourceType");
      expect(source).toHaveProperty("sourceTypeFa");
      expect(source).toHaveProperty("title");
      expect(source).toHaveProperty("articleSection");
      expect(source).toHaveProperty("publicationAuthority");
      expect(source).toHaveProperty("jurisdiction");
      expect(source).toHaveProperty("effectiveDate");
      expect(source).toHaveProperty("versionDate");
      expect(source).toHaveProperty("excerpt");
      expect(source).toHaveProperty("url");
      expect(source).toHaveProperty("documentIdentifier");
      expect(source).toHaveProperty("status");
      expect(source).toHaveProperty("availability");
    });

    it("reference matches V1Reference contract", () => {
      const ref = fixtureV1References[0]!;
      expect(ref).toHaveProperty("id");
      expect(ref).toHaveProperty("conversationId");
      expect(ref).toHaveProperty("messageId");
      expect(ref).toHaveProperty("sourceId");
      expect(ref).toHaveProperty("locator");
      expect(ref).toHaveProperty("quote");
      expect(ref).toHaveProperty("section");
    });

    it("source version matches V1SourceVersion contract", () => {
      const ver = fixtureV1SourceVersions[0]!;
      expect(ver).toHaveProperty("id");
      expect(ver).toHaveProperty("sourceId");
      expect(ver).toHaveProperty("versionDate");
      expect(ver).toHaveProperty("changes");
      expect(ver).toHaveProperty("effectiveDate");
    });
  });
});
