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
} from "@/lib/contracts/unified";
import { normalizeFa, searchTemplates, faIncludes } from "@/lib/contracts/search";
import { matchesTemplateCategory, templateCategoryFor } from "@/lib/contracts/categories";
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
    expect(u.status).toBe("draft");
    expect(u.progress).toBe(40);
    expect(u.actionable).toBe(true);
    expect(u.deletable).toBe(true);
  });

  it("folds a legacy V1 row, falling back to its id for the reference code", () => {
    const u = toUnifiedV1Contract(makeV1());
    expect(u.source).toBe("v1");
    expect(u.referenceCode).toBe("cnt-lease-001");
    expect(u.status).toBe("generated");
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

  it("groups into the four «همه» buckets and drops empty ones", () => {
    const draft = toUnifiedPropertyContract(makeProperty({ id: "d", state: "DRAFT" }));
    const archived = toUnifiedPropertyContract(
      makeProperty({ id: "z", state: "ARCHIVED", stateFa: "بایگانی" })
    );
    const groups = groupUnifiedContracts([draft, archived]);
    expect(groups.map((g) => g.key)).toEqual(["needs-work", "archived"]);
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
  it("renders a card per implemented template with a «شروع» action", () => {
    render(
      <ContractTemplateGrid query="" category="all" onStart={() => {}} />
    );
    // Every implemented definition is present.
    expect(screen.getByText("رهن و اجاره ملک مسکونی")).toBeInTheDocument();
    expect(screen.getByText("توافقنامه محرمانگی (NDA)")).toBeInTheDocument();
    expect(screen.getAllByText("شروع").length).toBeGreaterThan(0);
  });

  it("filters by category", () => {
    render(
      <ContractTemplateGrid query="" category="business" onStart={() => {}} />
    );
    expect(screen.getByText("توافقنامه محرمانگی (NDA)")).toBeInTheDocument();
    expect(screen.queryByText("رهن و اجاره ملک مسکونی")).not.toBeInTheDocument();
  });

  it("filters by the shared search query", () => {
    render(
      <ContractTemplateGrid query="محرمانگی" category="all" onStart={() => {}} />
    );
    expect(screen.getByText("توافقنامه محرمانگی (NDA)")).toBeInTheDocument();
    expect(screen.queryByText("رهن و اجاره ملک مسکونی")).not.toBeInTheDocument();
  });

  it("calls onStart with the chosen definition", () => {
    const onStart = vi.fn();
    render(<ContractTemplateGrid query="" category="all" onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "شروع رهن و اجاره ملک مسکونی" }));
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

  it("shows the «ادامه دهید» block when drafts exist", () => {
    render(
      <MyContractsSection
        contracts={[draft, finalized]}
        isLoading={false}
        onDelete={() => {}}
        onCopyId={() => {}}
        query=""
      />
    );
    expect(screen.getByText("ادامه دهید")).toBeInTheDocument();
  });

  it("hides the «ادامه دهید» block when there are no drafts", () => {
    render(
      <MyContractsSection
        contracts={[finalized]}
        isLoading={false}
        onDelete={() => {}}
        onCopyId={() => {}}
        query=""
      />
    );
    expect(screen.queryByText("ادامه دهید")).not.toBeInTheDocument();
  });

  it("shows the no-contracts empty state when the list is empty", () => {
    render(
      <MyContractsSection
        contracts={[]}
        isLoading={false}
        onDelete={() => {}}
        onCopyId={() => {}}
        query=""
      />
    );
    expect(screen.getByText("هنوز قراردادی نساخته‌اید")).toBeInTheDocument();
  });

  it("shows the no-results empty state when the query excludes everything", () => {
    render(
      <MyContractsSection
        contracts={[draft]}
        isLoading={false}
        onDelete={() => {}}
        onCopyId={() => {}}
        query="چیزی که وجود ندارد"
      />
    );
    expect(screen.getByText("قراردادی با این شرایط پیدا نشد")).toBeInTheDocument();
  });

  it("groups contracts under «نیازمند ادامه» on the «همه» view", () => {
    render(
      <MyContractsSection
        contracts={[draft, finalized]}
        isLoading={false}
        onDelete={() => {}}
        onCopyId={() => {}}
        query=""
      />
    );
    expect(screen.getByText("نیازمند ادامه")).toBeInTheDocument();
    expect(screen.getByText("قراردادهای آماده")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Card distinction
// ------------------------------------------------------------

describe("template card vs user card", () => {
  it("a template card leads with a «شروع» verb and no status badge", () => {
    render(
      <ContractTemplateCard
        definition={getContractDefinition("property_rent")}
        onStart={() => {}}
      />
    );
    expect(screen.getByText("شروع")).toBeInTheDocument();
    expect(screen.queryByText("پیش‌نویس")).not.toBeInTheDocument();
  });

  it("a user card leads with status, progress and a resume verb", () => {
    const contract = toUnifiedPropertyContract(makeProperty());
    render(<UserContractCard contract={contract} onCopyId={() => {}} />);
    // Status label, real progress and the status-specific action.
    expect(screen.getByText("پیش‌نویس")).toBeInTheDocument();
    expect(screen.getByText("40٪")).toBeInTheDocument();
    expect(screen.getByText("ادامه تکمیل")).toBeInTheDocument();
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
        onRetrySave={() => {}}
        onCopyId={() => {}}
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
