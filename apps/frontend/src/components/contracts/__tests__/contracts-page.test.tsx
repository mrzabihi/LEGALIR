// ============================================================
// LEGALIR — Contracts page tests
// ============================================================
// Covers the two-section Contracts page and the workspace header:
//   • the unified model folds both lifecycles and sorts drafts first
//   • the Persian-aware search matches synonyms and ZWNJ variants
//   • SECTION 1 renders the template library, SECTION 2 the user's work
//   • a template card and a user card are visually distinct
//   • the workspace header reports REAL progress and REAL save status
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type {
  PropertyContractListItem,
  V1ContractListItem,
  ContractCompletenessSection,
} from "@legalir/types";
import {
  toUnifiedPropertyContract,
  toUnifiedV1Contract,
  sortUnifiedContracts,
  groupUnifiedContracts,
  resumableContracts,
  type UnifiedContract,
} from "@/lib/contracts/unified";
import { normalizeFa, searchTemplates, faIncludes } from "@/lib/contracts/search";
import { matchesTemplateCategory, templateCategoryFor } from "@/lib/contracts/categories";
import {
  DEFAULT_CONTRACT_FILTERS,
  applyContractFilters,
  parseContractFilters,
  serializeContractFilters,
  activeFilterChips,
  removeFilterChip,
  type ContractFilterState,
} from "@/lib/contracts/filters";
import { ContractTemplateGrid } from "../contract-template-grid";
import { MyContractsSection } from "../my-contracts-section";
import { UserContractCard } from "../user-contract-card";
import { ContractTemplateCard } from "../contract-template-card";
import { ContractTemplatePreview } from "../contract-template-preview";
import { PaginationBar } from "../pagination-bar";
import { CompactContractSections } from "../compact-contract-sections";
import { ContractWorkspaceHeader } from "../builder/contract-workspace-header";
import {
  getContractDefinition,
  implementedContractDefinitions,
  TERMINAL_WIZARD_STEP_IDS,
} from "@/lib/contracts/registry";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  CONTRACT_ARTWORK,
  CONTRACT_SERVICE_ARTWORK,
  contractArtwork,
  contractServiceArtwork,
  hasContractArtwork,
} from "@/lib/contracts/artwork";
import { hasContractVisual } from "@/lib/contracts/visuals";
import fs from "node:fs";
import path from "node:path";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function makeProperty(
  overrides: Partial<PropertyContractListItem> = {}
): PropertyContractListItem {
  return {
    id: "pc-1",
    referenceCode: "LGL-RENT-1405-000016",
    domain: "property",
    type: "property_rent",
    typeFa: "رهن و اجاره ملک مسکونی",
    title: "قرارداد اجاره آپارتمان",
    state: "DRAFT",
    stateFa: "پیش‌نویس",
    progress: 40,
    locationFa: "پاسداران، تهران",
    partySummaryFa: "علی رضایی و مریم محمدی",
    currentStep: "financial",
    currentStepTitleFa: "شرایط مالی",
    analysisStatus: "not_reviewed",
    lastAnalyzedAt: null,
    archived: false,
    exportedAt: null,
    updatedAt: "2026-09-20T10:00:00.000Z",
    createdAt: "2026-09-19T10:00:00.000Z",
    ...overrides,
  };
}

function makeV1(overrides: Partial<V1ContractListItem> = {}): V1ContractListItem {
  return {
    id: "cnt-lease-001",
    title: "قرارداد اجاره آپارتمان",
    type: "lease",
    typeFa: "اجاره",
    category: "personal",
    state: "generated",
    currentVersionNumber: 2,
    createdAt: "2026-07-30T10:00:00Z",
    updatedAt: "2026-07-30T11:00:00Z",
    hasDraft: false,
    ...overrides,
  };
}

// ------------------------------------------------------------
// Unified model
// ------------------------------------------------------------

describe("unified contract model", () => {
  it("folds a Contract-OS row, keeping its reference code", () => {
    const u = toUnifiedPropertyContract(makeProperty());
    expect(u.source).toBe("os");
    expect(u.referenceCode).toBe("LGL-RENT-1405-000016");
    // The DRAFT axis: a raw DRAFT state is «شروع‌شده».
    expect(u.status).toBe("started");
    expect(u.progress).toBe(40);
    expect(u.actionable).toBe(true);
    expect(u.deletable).toBe(true);
  });

  it("folds a legacy V1 row, falling back to its id for the reference code", () => {
    const u = toUnifiedV1Contract(makeV1());
    expect(u.source).toBe("v1");
    expect(u.referenceCode).toBe("cnt-lease-001");
    // The DRAFT axis: a generated V1 contract has a complete text.
    expect(u.status).toBe("ready");
    // V1 contracts have no completeness, so progress is 0.
    expect(u.progress).toBe(0);
    expect(u.deletable).toBe(false);
  });

  it("sorts drafts and in-progress work above finished contracts", () => {
    const finished = toUnifiedPropertyContract(
      makeProperty({ id: "a", state: "FINALIZED", stateFa: "نهایی‌شده" })
    );
    const draft = toUnifiedPropertyContract(makeProperty({ id: "b", state: "DRAFT" }));
    const sorted = sortUnifiedContracts([finished, draft]);
    expect(sorted[0]!.id).toBe("b");
    expect(sorted[1]!.id).toBe("a");
  });

  it("breaks ties by most-recently-updated", () => {
    const older = toUnifiedPropertyContract(
      makeProperty({ id: "old", updatedAt: "2026-09-01T00:00:00.000Z" })
    );
    const newer = toUnifiedPropertyContract(
      makeProperty({ id: "new", updatedAt: "2026-09-20T00:00:00.000Z" })
    );
    const sorted = sortUnifiedContracts([older, newer]);
    expect(sorted[0]!.id).toBe("new");
  });

  it("groups into the «همه» buckets and drops empty ones", () => {
    const draft = toUnifiedPropertyContract(makeProperty({ id: "d", state: "DRAFT" }));
    const archived = toUnifiedPropertyContract(
      makeProperty({ id: "z", state: "ARCHIVED", stateFa: "بایگانی" })
    );
    const groups = groupUnifiedContracts([draft, archived]);
    // An ARCHIVED raw state maps to the READY draft axis, so it lands in
    // the «قراردادهای آماده» bucket — the archive axis is separate.
    expect(groups.map((g) => g.key)).toEqual(["needs-work", "ready"]);
    expect(groups[0]!.titleFa).toBe("نیازمند ادامه");
  });

  it("resumableContracts returns only actionable work", () => {
    const draft = toUnifiedPropertyContract(makeProperty({ id: "d", state: "DRAFT" }));
    const done = toUnifiedPropertyContract(
      makeProperty({ id: "f", state: "FINALIZED", stateFa: "نهایی‌شده" })
    );
    const resumable = resumableContracts([draft, done]);
    expect(resumable.map((c) => c.id)).toEqual(["d"]);
  });
});

// ------------------------------------------------------------
// Persian-aware search
// ------------------------------------------------------------

describe("Persian-aware search", () => {
  it("normalises Arabic yeh/kaf and strips ZWNJ", () => {
    expect(normalizeFa("نرم‌افزار")).toBe(normalizeFa("نرم افزار"));
    expect(normalizeFa("كتاب")).toBe(normalizeFa("کتاب"));
  });

  it("matches a template by a synonym keyword", () => {
    const defs = [getContractDefinition("property_rent")];
    const results = searchTemplates(defs, "مستأجر", (d) => ({
      id: d.id,
      titleFa: d.typeFa,
      descriptionFa: d.descriptionFa,
      categoryFa: d.categoryFa,
      keywords: d.keywords,
    }));
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("property_rent");
  });

  it("matches «خودرو» to the vehicle template", () => {
    const defs = [getContractDefinition("vehicle_sale")];
    const results = searchTemplates(defs, "خودرو", (d) => ({
      id: d.id,
      titleFa: d.typeFa,
      descriptionFa: d.descriptionFa,
      categoryFa: d.categoryFa,
      keywords: d.keywords,
    }));
    expect(results).toHaveLength(1);
  });

  it("faIncludes is true for an empty query", () => {
    expect(faIncludes("هرچیزی", "")).toBe(true);
  });

  it("searches name + keywords only when description is not supplied", () => {
    // The contract catalog passes name + keywords, per the brief's «جستجوی
    // ساده». A descriptive phrase in another template's prose must not make
    // it a hit — cloud IaaS says «اجارهٔ زیرساخت ابری» in its description.
    const defs = [
      getContractDefinition("property_rent"),
      getContractDefinition("commercial_rent"),
      getContractDefinition("cloud_iaas"),
    ];
    const asSearchable = (d: (typeof defs)[number]) => ({
      id: d.id,
      titleFa: d.typeFa,
      keywords: d.keywords,
    });
    const results = searchTemplates(defs, "اجاره", asSearchable);
    expect(results.map((d) => d.id).sort()).toEqual(["commercial_rent", "property_rent"]);
  });
});

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

describe("template categories", () => {
  it("files property types under املاک and business types under تجاری", () => {
    expect(templateCategoryFor("property_rent")).toBe("property");
    expect(templateCategoryFor("nda")).toBe("business");
    expect(templateCategoryFor("vehicle_sale")).toBe("personal");
  });

  it("«همه» matches every type", () => {
    expect(matchesTemplateCategory("nda", "all")).toBe(true);
    expect(matchesTemplateCategory("nda", "property")).toBe(false);
  });
});

// ------------------------------------------------------------
// SECTION 1 — template library
// ------------------------------------------------------------

describe("ContractTemplateGrid (SECTION 1)", () => {
  it("renders a card per implemented template with a SPECIFIC action", () => {
    render(
      <ContractTemplateGrid query="" category="all" onStart={() => undefined} />
    );
    // Every implemented definition is present.
    expect(screen.getByText("رهن و اجاره ملک مسکونی")).toBeInTheDocument();
    expect(screen.getByText("توافقنامه محرمانگی (NDA)")).toBeInTheDocument();
    // The CTA names the exact document, not a generic «شروع».
    expect(screen.getByText("تنظیم قرارداد اجاره")).toBeInTheDocument();
    expect(screen.getByText("تنظیم توافقنامه محرمانگی")).toBeInTheDocument();
  });

  it("filters by category", () => {
    render(
      <ContractTemplateGrid query="" category="business" onStart={() => undefined} />
    );
    expect(screen.getByText("توافقنامه محرمانگی (NDA)")).toBeInTheDocument();
    expect(screen.queryByText("رهن و اجاره ملک مسکونی")).not.toBeInTheDocument();
  });

  it("filters by the shared search query", () => {
    render(
      <ContractTemplateGrid query="محرمانگی" category="all" onStart={() => undefined} />
    );
    expect(screen.getByText("توافقنامه محرمانگی (NDA)")).toBeInTheDocument();
    expect(screen.queryByText("رهن و اجاره ملک مسکونی")).not.toBeInTheDocument();
  });

  it("calls onStart with the chosen definition", () => {
    const onStart = vi.fn();
    render(<ContractTemplateGrid query="" category="all" onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "تنظیم قرارداد اجاره" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0]![0].id).toBe("property_rent");
  });
});

// ------------------------------------------------------------
// Contract artwork (one image per type)
// ------------------------------------------------------------

describe("contract artwork", () => {
  it("maps every photo contract type to a distinct public asset", () => {
    const photoTypes = [
      "property_rent",
      "property_sale",
      "vehicle_sale",
      "debt",
      "freelance",
      "nda",
      "saas",
      "startup",
      "commercial_rent",
      "commercial_sale",
      "cloud_iaas",
      "cloud_paas",
      "employment",
    ];
    const paths = photoTypes.map((t) => contractArtwork(t));
    // Every one resolves, and no two share an image (a duplicate would
    // mean a contract is showing the wrong picture).
    expect(paths.every((p) => typeof p === "string" && p.length > 0)).toBe(true);
    expect(new Set(paths).size).toBe(photoTypes.length);
    // Each path is root-relative (portable, no `D:\` machine paths).
    for (const p of paths) expect(p!.startsWith("/assets/contracts/")).toBe(true);
  });

  it("falls back to null (SVG scene) for a type with no photograph", () => {
    // `cloud_baas` is the one registered type with neither a composition
    // nor a service page, so it is the live example of the fallback.
    expect(hasContractArtwork("cloud_baas")).toBe(false);
    expect(contractArtwork("cloud_baas")).toBeNull();
  });

  it("maps the illustrated catalog services to their own assets", () => {
    const serviceIds = [
      "commercial-lease-contract",
      "pre-sale-contract",
      "contracting-agreement",
      "remote-work-contract",
      "internship-contract",
    ];
    const paths = serviceIds.map((id) => contractServiceArtwork(id));
    expect(paths.every((p) => typeof p === "string" && p.length > 0)).toBe(true);
    for (const p of paths) expect(p!.startsWith("/assets/contracts/")).toBe(true);
    // An unillustrated service yields null so the card keeps its icon.
    expect(contractServiceArtwork("goodwill-contract")).toBeNull();
  });

  it("every mapped image actually exists in public/ and is non-empty", () => {
    // Guards the "images must be present in the final build" requirement:
    // a typo'd filename would 404 in production, so assert each file ships.
    const maps = { ...CONTRACT_ARTWORK, ...CONTRACT_SERVICE_ARTWORK };
    for (const [key, rel] of Object.entries(maps)) {
      const abs = path.join(process.cwd(), "public", rel);
      expect(fs.existsSync(abs), `missing artwork for ${key}: ${rel}`).toBe(true);
      expect(fs.statSync(abs).size, `empty artwork for ${key}: ${rel}`).toBeGreaterThan(0);
    }
  });

  it("every implemented type either has artwork or the SVG fallback scene", () => {
    for (const def of implementedContractDefinitions()) {
      const hasEither = hasContractArtwork(def.id) || hasContractVisual(def.id);
      expect(hasEither, `no visual for ${def.id}`).toBe(true);
    }
  });
});

// ------------------------------------------------------------
// SECTION 2 — my contracts
// ------------------------------------------------------------

describe("MyContractsSection (SECTION 2)", () => {
  const draft = toUnifiedPropertyContract(makeProperty({ id: "d1", state: "DRAFT" }));
  const finalized = toUnifiedPropertyContract(
    makeProperty({ id: "f1", state: "FINALIZED", stateFa: "نهایی‌شده", progress: 100 })
  );

  function renderSection(
    contracts: UnifiedContract[],
    filters: Partial<ContractFilterState> = {},
    overrides: Partial<React.ComponentProps<typeof MyContractsSection>> = {}
  ) {
    return render(
      <MyContractsSection
        contracts={contracts}
        isLoading={false}
        onDelete={() => undefined}
        onCopyId={() => undefined}
        filters={{ ...DEFAULT_CONTRACT_FILTERS, ...filters }}
        onFiltersChange={() => undefined}
        {...overrides}
      />
    );
  }

  it("renders BOTH workflow subsections even when one is empty", () => {
    renderSection([finalized]);
    // «نیازمند ادامه» has nothing to show, but it still appears — with
    // guidance — so the user can tell "nothing to continue" apart from
    // "the section is missing".
    expect(screen.getByText("نیازمند ادامه")).toBeInTheDocument();
    expect(screen.getByText("قراردادهای آماده")).toBeInTheDocument();
    expect(
      screen.getByText("قراردادی برای ادامه ندارید؛ همه قراردادهای شما تکمیل شده‌اند.")
    ).toBeInTheDocument();
  });

  it("caps each subsection at three rows and reveals more on demand", () => {
    const drafts = Array.from({ length: 10 }, (_, i) =>
      toUnifiedPropertyContract(makeProperty({ id: `d${i}`, title: `قرارداد ${i}` }))
    );
    renderSection(drafts);
    // The test environment reports a phone-width media query, so the cap
    // is three rows of ONE column: the fourth card must be hidden.
    expect(screen.queryByText("قرارداد 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /مشاهده بیشتر/ }));
    expect(screen.getByText("قرارداد 3")).toBeInTheDocument();
  });

  it("shows the no-contracts empty state when the list is empty", () => {
    renderSection([]);
    expect(screen.getByText("هنوز قراردادی نساخته‌اید")).toBeInTheDocument();
  });

  it("shows the no-results empty state when the query excludes everything", () => {
    renderSection([draft], { query: "چیزی که وجود ندارد" });
    expect(screen.getByText("قراردادی با این شرایط پیدا نشد")).toBeInTheDocument();
  });

  it("groups contracts under «نیازمند ادامه» on the «همه» view", () => {
    renderSection([draft, finalized]);
    expect(screen.getByText("نیازمند ادامه")).toBeInTheDocument();
    expect(screen.getByText("قراردادهای آماده")).toBeInTheDocument();
  });

  it("shows a retry affordance when the list failed to load", () => {
    const onRetry = vi.fn();
    renderSection([], {}, { isError: true, onRetry });
    expect(screen.getByText("بارگذاری قراردادها ناموفق بود")).toBeInTheDocument();
    fireEvent.click(screen.getByText("تلاش مجدد"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the active-filter chips and removes one on click", () => {
    const onFiltersChange = vi.fn();
    renderSection([draft], { draft: ["started"] }, { onFiltersChange });
    // The chip label is the draft-status label.
    fireEvent.click(screen.getByRole("button", { name: "حذف فیلتر شروع‌شده" }));
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange.mock.calls[0]![0].draft).toEqual([]);
  });
});

// ------------------------------------------------------------
// Filter model (spec §6)
// ------------------------------------------------------------

describe("contract filter model", () => {
  const draft = toUnifiedPropertyContract(makeProperty({ id: "d1", state: "DRAFT" }));
  const finalized = toUnifiedPropertyContract(
    makeProperty({ id: "f1", state: "FINALIZED", stateFa: "نهایی‌شده", progress: 100 })
  );

  it("round-trips a filter state through the URL, omitting defaults", () => {
    const state: ContractFilterState = {
      ...DEFAULT_CONTRACT_FILTERS,
      tab: "needs_work",
      draft: ["started", "in_progress"],
      analysis: ["not_reviewed"],
      types: ["property_rent"],
      dateRange: "30d",
      sort: "title",
    };
    const params = serializeContractFilters(state);
    expect(params.get("tab")).toBe("needs_work");
    expect(params.get("draft")).toBe("started,in_progress");
    expect(params.get("type")).toBe("property_rent");
    expect(params.get("range")).toBe("30d");
    expect(params.get("sort")).toBe("title");
    expect(parseContractFilters(params)).toEqual(state);
  });

  it("produces a clean URL for the default state", () => {
    expect(serializeContractFilters(DEFAULT_CONTRACT_FILTERS).toString()).toBe("");
  });

  it("ignores unknown values when parsing", () => {
    const params = new URLSearchParams("tab=bogus&range=99d&sort=nope&draft=started,bogus");
    const parsed = parseContractFilters(params);
    expect(parsed.tab).toBe("all");
    expect(parsed.dateRange).toBe("any");
    expect(parsed.sort).toBe("updated");
    expect(parsed.draft).toEqual(["started"]);
  });

  it("ANDs between groups and ORs within a group", () => {
    // draft OR: started matches; analysis AND: not_reviewed matches.
    const both = applyContractFilters([draft, finalized], {
      ...DEFAULT_CONTRACT_FILTERS,
      draft: ["started", "in_progress"],
      analysis: ["not_reviewed"],
    });
    expect(both.map((c) => c.id)).toEqual(["d1"]);

    // A draft filter that excludes the draft leaves nothing.
    const none = applyContractFilters([draft, finalized], {
      ...DEFAULT_CONTRACT_FILTERS,
      draft: ["ready"],
    });
    expect(none.map((c) => c.id)).toEqual(["f1"]);
  });

  it("describes active filters as removable chips", () => {
    const chips = activeFilterChips({
      ...DEFAULT_CONTRACT_FILTERS,
      tab: "ready",
      draft: ["ready"],
      sort: "title",
    });
    expect(chips.map((c) => c.group)).toEqual(["tab", "draft", "sort"]);
    const removed = removeFilterChip(
      { ...DEFAULT_CONTRACT_FILTERS, draft: ["ready"] },
      { group: "draft", value: "ready", labelFa: "متن آماده" }
    );
    expect(removed.draft).toEqual([]);
  });
});

// ------------------------------------------------------------
// Card distinction
// ------------------------------------------------------------

describe("template card vs user card", () => {
  it("a template card leads with a specific CTA and no status badge", () => {
    render(
      <ContractTemplateCard
        definition={getContractDefinition("property_rent")}
        onStart={() => undefined}
      />
    );
    expect(screen.getByText("تنظیم قرارداد اجاره")).toBeInTheDocument();
    expect(screen.queryByText("پیش‌نویس")).not.toBeInTheDocument();
  });

  it("a user card leads with status, progress and a resume verb", () => {
    const contract = toUnifiedPropertyContract(makeProperty());
    render(<UserContractCard contract={contract} onCopyId={() => undefined} />);
    // Status label, real progress and the status-specific action.
    expect(screen.getByText("پیش‌نویس")).toBeInTheDocument();
    expect(screen.getByText("40٪")).toBeInTheDocument();
    expect(screen.getByText("ادامه تکمیل")).toBeInTheDocument();
  });

  it("a user card shows the AI-review axis separately from the draft axis", () => {
    const contract = toUnifiedPropertyContract(
      makeProperty({ analysisStatus: "needs_re_review" })
    );
    render(<UserContractCard contract={contract} onCopyId={() => undefined} />);
    // The analysis badge is labelled as an AI review, never a verdict.
    expect(
      screen.getByText("بررسی هوش مصنوعی: نیازمند بررسی مجدد")
    ).toBeInTheDocument();
    // A stale review makes the primary verb about re-reviewing.
    expect(screen.getByText("بررسی نسخه جدید")).toBeInTheDocument();
  });

  it("a compact user card keeps only name, state and last change", () => {
    const contract = toUnifiedPropertyContract(makeProperty());
    render(
      <UserContractCard contract={contract} layout="compact" onCopyId={() => undefined} />
    );
    expect(screen.getByText("قرارداد اجاره آپارتمان")).toBeInTheDocument();
    expect(screen.getByText("پیش‌نویس")).toBeInTheDocument();
    expect(screen.getByText(/آخرین تغییر:/)).toBeInTheDocument();
    expect(screen.getByText("ادامه تکمیل")).toBeInTheDocument();
    // The heavy AI-review badge is not part of the compact card.
    expect(
      screen.queryByText("بررسی هوش مصنوعی: انجام‌نشده")
    ).not.toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Template card: preview vs start (two distinct actions)
// ------------------------------------------------------------

describe("template card actions", () => {
  it("offers preview and start as separate controls", () => {
    const onStart = vi.fn();
    const onPreview = vi.fn();
    render(
      <ContractTemplateCard
        definition={getContractDefinition("nda")}
        onStart={onStart}
        onPreview={onPreview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "پیش‌نمایش توافقنامه محرمانگی (NDA)" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    // Previewing must NEVER create a draft.
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /تنظیم توافقنامه محرمانگی/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("renders the real step and mandatory-document counts", () => {
    const def = getContractDefinition("property_rent");
    // The terminal stages own no fields, so the count is the fillable steps.
    const expectedSteps = def.wizardSteps.filter(
      (s) => !TERMINAL_WIZARD_STEP_IDS.includes(s.id)
    ).length;
    const expectedDocs = def.requiredDocuments.filter((d) => d.required).length;
    render(<ContractTemplateCard definition={def} onStart={() => undefined} />);
    expect(screen.getByText(`${toPersianNumber(expectedSteps)} مرحله`)).toBeInTheDocument();
    expect(screen.getByText(`${toPersianNumber(expectedDocs)} مدرک الزامی`)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Preview dialog
// ------------------------------------------------------------

describe("ContractTemplatePreview", () => {
  it("shows the contract structure from the registry definition", () => {
    const def = getContractDefinition("property_rent");
    render(
      <ContractTemplatePreview definition={def} onClose={() => undefined} onStart={() => undefined} />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // The step titles are asserted INSIDE the structure block: a step
    // title may legitimately repeat elsewhere (e.g. «طرفین قرارداد» is
    // also a summary label).
    const structure = screen.getByText("ساختار قرارداد").closest("section");
    expect(structure).not.toBeNull();
    // Every data-owning wizard step is listed with its real title; the
    // terminal stages are not data-entry sections.
    for (const step of def.wizardSteps.filter(
      (s) => !TERMINAL_WIZARD_STEP_IDS.includes(s.id)
    )) {
      expect(within(structure as HTMLElement).getByText(step.titleFa)).toBeInTheDocument();
    }
    // The parties and the document list come from the definition.
    expect(screen.getByText("موجر و مستأجر")).toBeInTheDocument();
    expect(screen.getByText("مدارک موردنیاز")).toBeInTheDocument();
  });

  it("starts the contract from the dialog footer", () => {
    const onStart = vi.fn();
    const def = getContractDefinition("debt");
    render(
      <ContractTemplatePreview definition={def} onClose={() => undefined} onStart={onStart} />
    );
    fireEvent.click(screen.getByRole("button", { name: /تنظیم قرارداد قرض/ }));
    expect(onStart).toHaveBeenCalledWith(def);
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ContractTemplatePreview definition={null} onClose={() => undefined} onStart={() => undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ------------------------------------------------------------
// Pagination bar (the 20-per-page rule, as the user sees it)
// ------------------------------------------------------------

describe("PaginationBar", () => {
  it("states the visible range, the page and the total page count", () => {
    render(
      <PaginationBar
        page={1}
        totalPages={2}
        total={25}
        itemLabel="قالب قرارداد"
        pageSize={20}
        onPageChange={() => undefined}
      />
    );

    // Both the range and the position are spelled out — no guessing.
    expect(screen.getByText(/۱ تا ۲۰ از ۲۵ قالب قرارداد/)).toBeInTheDocument();
    expect(screen.getByText(/صفحه ۱ از ۲/)).toBeInTheDocument();
    // The compact mobile indicator mirrors the same facts.
    expect(screen.getByText("۱ / ۲")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "صفحه ۱" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    // The previous arrow cannot leave the first page.
    expect(screen.getByRole("button", { name: "صفحه قبل" })).toBeDisabled();
  });

  it("reports the remainder range on the last page", () => {
    render(
      <PaginationBar
        page={2}
        totalPages={2}
        total={25}
        itemLabel="قالب قرارداد"
        pageSize={20}
        onPageChange={() => undefined}
      />
    );
    expect(screen.getByText(/۲۱ تا ۲۵ از ۲۵ قالب قرارداد/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "صفحه بعد" })).toBeDisabled();
  });

  it("collapses to a plain count when there is only one page", () => {
    render(
      <PaginationBar page={1} totalPages={1} total={14} itemLabel="قالب قرارداد" onPageChange={() => undefined} />
    );
    expect(screen.queryByRole("navigation", { name: "صفحه‌بندی" })).not.toBeInTheDocument();
    expect(screen.getByText("۱۴ قالب قرارداد")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Compact own-contract sections (below the catalog)
// ------------------------------------------------------------

describe("CompactContractSections", () => {
  const handlers = {
    isLoading: false,
    isError: false,
    onRetry: () => undefined,
    onDelete: () => undefined,
    onCopyId: () => undefined,
  };

  it("renders the two sections with compact cards once data arrives", () => {
    const contract = toUnifiedPropertyContract(makeProperty());
    render(<CompactContractSections contracts={[contract]} {...handlers} />);

    expect(screen.getByRole("heading", { name: "قراردادهای من" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "قراردادهای نیازمند ادامه" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "قراردادهای آماده" })).toBeInTheDocument();
    // The compact card keeps name, state and last change only.
    expect(screen.getByText("قرارداد اجاره آپارتمان")).toBeInTheDocument();
    expect(screen.getByText(/آخرین تغییر:/)).toBeInTheDocument();
  });

  it("guides an empty account toward the catalog instead of a dead section", () => {
    render(<CompactContractSections contracts={[]} {...handlers} />);
    expect(
      screen.getByText(/هنوز قراردادی نساخته‌اید\. یکی از قراردادهای بالا/)
    ).toBeInTheDocument();
  });

  it("surfaces a real retry when the fetch fails", () => {
    const onRetry = vi.fn();
    render(
      <CompactContractSections contracts={[]} {...handlers} isError onRetry={onRetry} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("بارگذاری قراردادهای شما ناموفق بود.");
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows skeletons while loading, never an empty-state claim", () => {
    render(<CompactContractSections contracts={[]} {...handlers} isLoading />);
    expect(
      screen.getByLabelText("در حال بارگذاری قراردادهای من")
    ).toBeInTheDocument();
    expect(screen.queryByText(/هنوز قراردادی نساخته‌اید/)).not.toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Workspace header
// ------------------------------------------------------------

describe("ContractWorkspaceHeader", () => {
  const sections: ContractCompletenessSection[] = [
    { key: "parties", labelFa: "طرفین قرارداد", percent: 100, missing: [] },
    { key: "property", labelFa: "مشخصات ملک", percent: 50, missing: ["متراژ"] },
    { key: "financial", labelFa: "شرایط مالی", percent: 0, missing: ["ودیعه"] },
  ];

  function renderHeader(
    overrides: Partial<React.ComponentProps<typeof ContractWorkspaceHeader>> = {}
  ) {
    return render(
      <ContractWorkspaceHeader
        title="رهن و اجاره ملک مسکونی"
        referenceCode="LGL-RENT-1405-000016"
        typeFa="رهن و اجاره ملک مسکونی"
        stateFa="پیش‌نویس"
        progress={50}
        sections={sections}
        blockers={[]}
        stepIndex={1}
        stepCount={5}
        saveStatus="idle"
        lastSavedAt={null}
        onRetrySave={() => undefined}
        onCopyId={() => undefined}
        {...overrides}
      />
    );
  }

  it("exposes REAL progress through a progressbar role", () => {
    renderHeader();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("1 از 3 بخش تکمیل شده")).toBeInTheDocument();
  });

  it("announces the saving state politely", () => {
    renderHeader({ saveStatus: "saving" });
    expect(screen.getByText("در حال ذخیره...")).toBeInTheDocument();
  });

  it("shows the real failure reason and a retry affordance on save error", () => {
    const onRetry = vi.fn();
    renderHeader({
      saveStatus: "error",
      saveError: {
        messageFa: "ارتباط با سرور برقرار نشد.",
        code: "NETWORK",
        category: "network",
        retryable: true,
        correlationId: "req-1",
        at: "2026-10-18T10:00:00.000Z",
      },
      onRetrySave: onRetry,
    });
    // The concrete cause is shown, not a generic "save failed".
    expect(screen.getByText("ذخیره نشد — ارتباط با سرور برقرار نشد.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تلاش مجدد/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not offer a retry that cannot succeed", () => {
    const onRetry = vi.fn();
    renderHeader({
      saveStatus: "error",
      saveError: {
        messageFa: "این قرارداد قفل شده است.",
        code: "CONTRACT_FROZEN",
        category: "conflict",
        retryable: false,
        correlationId: "req-2",
        at: "2026-10-18T10:00:00.000Z",
      },
      onRetrySave: onRetry,
    });
    // Resending a request the server already refused would only reproduce
    // the same error, so no retry loop is offered.
    expect(screen.getByText("ذخیره نشد — این قرارداد قفل شده است.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /تلاش مجدد/ })).toBeNull();
  });

  it("confirms a successful save", () => {
    renderHeader({ saveStatus: "saved", lastSavedAt: "2026-09-20T10:00:00.000Z" });
    expect(screen.getByText("همه تغییرات ذخیره شده‌اند")).toBeInTheDocument();
  });

  it("lists the remaining sections as chips", () => {
    renderHeader();
    expect(screen.getByText("مشخصات ملک")).toBeInTheDocument();
    expect(screen.getByText("شرایط مالی")).toBeInTheDocument();
  });

  it("surfaces blockers as a warning", () => {
    renderHeader({
      blockers: [{ sectionKey: "financial", labelFa: "شرایط مالی", stepId: "financial" }],
    });
    expect(screen.getByText(/مورد مانع امضا/)).toBeInTheDocument();
  });

  it("copies the reference code when the copy button is pressed", () => {
    const onCopy = vi.fn();
    renderHeader({ onCopyId: onCopy });
    fireEvent.click(screen.getByRole("button", { name: "کپی شناسه قرارداد" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
