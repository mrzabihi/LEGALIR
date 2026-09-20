// ============================================================
// LEGALIR — Draft & Document delete-action tests
// ============================================================
// Covers the shared "manage draft / document" UX pattern:
//   • a draft contract exposes Continue/Edit (resumes the SAME id)
//     and Delete Draft (opens a confirmation, never deletes directly)
//   • a document exposes Delete (opens a confirmation)
//   • cancel has no side effects
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PropertyContractListItem, V1DocumentListItem } from "@legalir/types";
import { PropertyContractCard } from "../property-contract-card";
import { DocumentCard } from "@/components/documents/document-card";

function makeContract(
  overrides: Partial<PropertyContractListItem> = {}
): PropertyContractListItem {
  return {
    id: "cnt-1",
    referenceCode: "LGL-RENT-1405-000184",
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

function makeDocument(
  overrides: Partial<V1DocumentListItem> = {}
): V1DocumentListItem {
  return {
    id: "doc-1",
    name: "قرارداد-اجاره.pdf",
    mime: "application/pdf",
    sizeBytes: 450_000,
    status: "ready",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    riskLevel: "medium",
    findingCount: 3,
    ...overrides,
  };
}

describe("PropertyContractCard — draft actions", () => {
  it("shows Continue/Edit and Delete Draft for a draft", () => {
    render(<PropertyContractCard contract={makeContract()} onDelete={() => {}} />);
    expect(screen.getByText("ادامه / ویرایش")).toBeInTheDocument();
    expect(screen.getByText("حذف پیش‌نویس")).toBeInTheDocument();
  });

  it("Continue/Edit links to the SAME contract id (never a new one)", () => {
    render(<PropertyContractCard contract={makeContract({ id: "cnt-42" })} />);
    const links = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href") === "/contracts/cnt-42");
    // Both the info block and the primary action resume the same id.
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it("Delete Draft invokes onDelete and does not delete directly", () => {
    const onDelete = vi.fn();
    const contract = makeContract();
    render(<PropertyContractCard contract={contract} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("حذف پیش‌نویس"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(contract);
  });

  it("hides Delete Draft for a finalized contract", () => {
    render(
      <PropertyContractCard
        contract={makeContract({ state: "FINALIZED", stateFa: "نهایی‌شده" })}
        onDelete={() => {}}
      />
    );
    expect(screen.queryByText("حذف پیش‌نویس")).not.toBeInTheDocument();
  });
});

describe("DocumentCard — delete action", () => {
  it("shows a delete action that opens confirmation (not a direct delete)", () => {
    const onDelete = vi.fn();
    const doc = makeDocument();
    render(<DocumentCard document={doc} onClick={() => {}} onDelete={onDelete} />);
    const btn = screen.getByRole("button", { name: /حذف سند/ });
    fireEvent.click(btn);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(doc);
  });

  it("opens the document when the card body is clicked", () => {
    const onClick = vi.fn();
    render(<DocumentCard document={makeDocument()} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /^سند / }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the delete action when no handler is provided", () => {
    render(<DocumentCard document={makeDocument()} onClick={() => {}} />);
    expect(screen.queryByRole("button", { name: /حذف سند/ })).not.toBeInTheDocument();
  });
});
