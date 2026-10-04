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
import { render, screen, fireEvent } from "@testing-library/react";
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
import { ContractWorkspaceHeader } from "../builder/contract-workspace-header";
import { getContractDefinition } from "@/lib/contracts/registry";

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
    fireEvent.click(
      screen.getByRole("button", { name: "تنظیم قرارداد اجاره — رهن و اجاره ملک مسکونی" })
    );
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0]![0].id).toBe("property_rent");
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

  it("shows the «ادامه دهید» block when drafts exist", () => {
    renderSection([draft, finalized]);
    expect(screen.getByText("ادامه دهید")).toBeInTheDocument();
  });

  it("hides the «ادامه دهید» block when there are no drafts", () => {
    renderSection([finalized]);
    expect(screen.queryByText("ادامه دهید")).not.toBeInTheDocument();
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

  it("shows a retry affordance on save error", () => {
    const onRetry = vi.fn();
    renderHeader({ saveStatus: "error", onRetrySave: onRetry });
    fireEvent.click(screen.getByText("ذخیره انجام نشد — تلاش مجدد"));
    expect(onRetry).toHaveBeenCalledTimes(1);
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
