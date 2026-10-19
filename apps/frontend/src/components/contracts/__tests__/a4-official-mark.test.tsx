// ============================================================
// LEGALIR — The official seal + hologram on EVERY page (§4)
// ============================================================
// The server PDF draws the seal and the print-only hologram at the BOTTOM
// OF EVERY PAGE, inside the reserved footer band (`officialMarkPages`).
// The on-screen A4 sheet must show the very same artifact in the very same
// place — otherwise the operator approves one layout and the owner
// downloads another.
//
// These tests pin the three things that make that true:
//   1. every rendered page carries exactly one seal + one hologram, inside
//      its footer — never a single mark under the letterhead;
//   2. the disclaimer prints with each of them;
//   3. a page with no valid Super-Admin stamp carries neither, and the
//      draft watermark appears on every page instead.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render } from "@testing-library/react";
import type { ContractParty, PropertyContract } from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
} from "@legalir/types";
import { A4Document, type A4ReviewStamp } from "../document/a4-document";
import { getContractDefinition } from "@/lib/contracts/registry";

const SEAL_HREF = "/api/v1/property-contracts/ctr-1/stamp-asset/seal";
const HOLOGRAM_HREF = "/api/v1/property-contracts/ctr-1/stamp-asset/hologram";

/** The official mark: a Super-Admin stamp bound to this exact version. */
const OFFICIAL: A4ReviewStamp = {
  applied: true,
  official: true,
  sealHref: SEAL_HREF,
  hologramHref: HOLOGRAM_HREF,
  approvedByLabelFa: "مدیر ارشد لیگالیر",
  approvedAt: "2026-01-05T10:57:29.000Z",
};

/** The internal review mark only — no official seal was ever applied. */
const INTERNAL_ONLY: A4ReviewStamp = {
  applied: true,
  reviewedAt: "2026-01-04T10:00:00.000Z",
  reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
  reviewerInitials: "م.م",
};

function party(role: ContractParty["role"], first: string, last: string): ContractParty {
  return {
    id: `pty-${role}`,
    contractId: "ctr-1",
    role,
    capacity: "owner",
    identity: {
      firstName: first,
      lastName: last,
      fatherName: "علی",
      nationalId: "0012345678",
      birthCertificateNumber: "1234",
      birthCertificatePlace: "تهران",
      birthDate: null,
      mobile: "09121110001",
      address: "تهران",
      postalCode: "1234567890",
    },
    personKind: "natural",
    nationality: "iranian",
    representativeOfPartyId: null,
    representativePositionFa: "",
    ownershipShare: null,
    powerOfAttorney: null,
    banking: null,
    isInitiator: role === "landlord",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as ContractParty;
}

const PARTIES: ContractParty[] = [
  party("landlord", "مریم", "محمدی"),
  party("tenant", "رضا", "کریمی"),
];

function makeContract(state: PropertyContract["state"] = "FINALIZED"): PropertyContract {
  const data = getContractDefinition("property_rent").createDefaultData("apartment");
  return {
    id: "ctr-1",
    referenceCode: "LGL-RENT-1405-000001",
    userId: "usr-1",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state,
    initiatorRole: "landlord",
    initiatorSide: "first",
    title: "اجاره‌نامه آپارتمان",
    currentStep: "finalized",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data,
    currentVersionId: "ver-2",
    currentVersionNumber: 2,
    finalVersionId: state === "FINALIZED" ? "ver-2" : null,
    finalizedAt: state === "FINALIZED" ? "2026-01-05T10:57:29.000Z" : null,
    publicVerificationId: "vrf-1",
    caseId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-05T10:57:29.000Z",
  } as unknown as PropertyContract;
}

/**
 * jsdom has no layout, so every rect is zero and the paginator collapses
 * the whole document onto one sheet. Giving block boxes a fixed height and
 * the sheet a real A4 height forces the same multi-page distribution a
 * browser produces — which is the only way to prove the mark is drawn
 * once PER PAGE rather than once per document.
 */
const BLOCK_HEIGHT = 300;
const SHEET_HEIGHT = 1123;
const FOOTER_HEIGHT = 60;

const originalRect = Element.prototype.getBoundingClientRect;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const el = this as HTMLElement;
    let height = 0;
    if (el.dataset?.["a4Block"]) height = BLOCK_HEIGHT;
    else if (el.classList.contains("a4-page")) height = SHEET_HEIGHT;
    else if (el.classList.contains("a4-page-footer")) height = FOOTER_HEIGHT;
    const width = 700;
    return {
      height,
      width,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      x: 0,
      y: 0,
      toJSON: () => ({ height, width }),
    } as DOMRect;
  } as typeof Element.prototype.getBoundingClientRect;
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalRect;
});

function sheets(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".a4-pages-inner .a4-page"));
}

describe("A4Document — the official mark lives on every page (§4)", () => {
  it("renders a real multi-page document (the fixture is not collapsed)", () => {
    const { container } = render(
      <A4Document contract={makeContract()} parties={PARTIES} draft={false} reviewStamp={OFFICIAL} />
    );
    // Without genuine pagination the per-page assertions below are vacuous.
    expect(sheets(container).length).toBeGreaterThan(1);
  });

  it("draws exactly one seal and one hologram in EVERY page footer", () => {
    const { container } = render(
      <A4Document contract={makeContract()} parties={PARTIES} draft={false} reviewStamp={OFFICIAL} />
    );
    const pages = sheets(container);
    expect(pages.length).toBeGreaterThan(1);

    pages.forEach((sheet, index) => {
      const footer = sheet.querySelector<HTMLElement>(".a4-page-footer");
      expect(footer).not.toBeNull();
      // One mark per page — never stacked, never doubled by a re-render.
      expect(footer!.querySelectorAll("[data-a4-page-official]")).toHaveLength(1);
      const seal = footer!.querySelector<HTMLImageElement>("img.a4-seal");
      const hologram = footer!.querySelector<HTMLImageElement>("img.a4-hologram");
      expect(seal?.getAttribute("src")).toBe(SEAL_HREF);
      expect(hologram?.getAttribute("src")).toBe(HOLOGRAM_HREF);
      // The seal repeats on every sheet but is announced ONCE: page 1
      // carries the descriptive alternative text, later pages are
      // decorative (`alt=""`) so a screen reader does not read the same
      // mark five times. The IMAGE is still painted on every page.
      expect(seal?.getAttribute("alt")).toBe(
        index === 0 ? "مهر رسمی لیگالیر" : ""
      );
      expect(hologram?.getAttribute("alt")).toBe(
        index === 0 ? "هولوگرام لیگالیر" : ""
      );
      // The mandatory disclaimer is printed with each mark.
      expect(footer!.textContent).toContain(CONTRACT_REVIEW_STAMP_DISCLAIMER_FA);
    });
  });

  it("keeps the letterhead clean — the approval is recorded there as TEXT only", () => {
    const { container } = render(
      <A4Document contract={makeContract()} parties={PARTIES} draft={false} reviewStamp={OFFICIAL} />
    );
    const letterhead = container.querySelector<HTMLElement>(".a4-letterhead")!;
    expect(letterhead.querySelector("img.a4-seal")).toBeNull();
    expect(letterhead.querySelector("img.a4-hologram")).toBeNull();
    // The approval is still traceable from page 1.
    expect(letterhead.textContent).toContain("مدیر ارشد لیگالیر");
    expect(letterhead.textContent).toContain("مهر رسمی لیگالیر");
  });

  it("carries the print-only hologram ink in every footer — hidden on screen", () => {
    const { container } = render(
      <A4Document contract={makeContract()} parties={PARTIES} draft={false} reviewStamp={OFFICIAL} />
    );
    for (const sheet of sheets(container)) {
      const ink = sheet.querySelectorAll(".a4-hologram-ink");
      // Brand + serial, both present in the DOM on every page (globals.css
      // paints them only under `@media print`).
      expect(ink).toHaveLength(2);
    }
  });

  it("draws NO seal for a draft — the draft watermark stands on every page", () => {
    const { container } = render(
      <A4Document contract={makeContract("DRAFT")} parties={PARTIES} draft={true} reviewStamp={null} />
    );
    const pages = sheets(container);
    expect(pages.length).toBeGreaterThan(0);

    for (const sheet of pages) {
      expect(sheet.querySelector("img.a4-seal")).toBeNull();
      expect(sheet.querySelector("img.a4-hologram")).toBeNull();
      expect(sheet.textContent).toContain(CONTRACT_DRAFT_WATERMARK_FA);
    }
    expect(container.querySelector(".a4-page-official")).toBeNull();
  });

  it("draws NO seal for the internal review mark — only a Super-Admin stamp can", () => {
    const { container } = render(
      <A4Document
        contract={makeContract("ADMIN_APPROVED")}
        parties={PARTIES}
        draft={true}
        reviewStamp={INTERNAL_ONLY}
      />
    );

    // The internal mark itself is shown…
    expect(container.querySelector(".a4-review-stamp")).not.toBeNull();
    // …but it never draws the official seal or hologram.
    expect(container.querySelector(".a4-page-official")).toBeNull();
    expect(container.querySelector("img.a4-seal")).toBeNull();
    expect(container.querySelector("img.a4-hologram")).toBeNull();
  });

  it("never prints the draft watermark beside a review stamp — the two are exclusive", () => {
    // The PDF and DOCX renderers draw the watermark ONLY when no review
    // mark exists (`if (stamp.applied) stampBlock() else draftWatermark()`).
    // An approved-but-unsigned contract is still `draft`, yet it already
    // carries LEGALIR's mark — printing both would show a layout the
    // signed file never has.
    const withMark = render(
      <A4Document
        contract={makeContract("ADMIN_APPROVED")}
        parties={PARTIES}
        draft={true}
        reviewStamp={INTERNAL_ONLY}
      />
    );
    expect(withMark.container.querySelector(".a4-watermark")).toBeNull();
    withMark.unmount();

    const official = render(
      <A4Document
        contract={makeContract("ADMIN_APPROVED")}
        parties={PARTIES}
        draft={true}
        reviewStamp={OFFICIAL}
      />
    );
    expect(official.container.querySelector(".a4-watermark")).toBeNull();
    // …but an unreviewed draft still carries it on every page.
    official.unmount();

    const plain = render(
      <A4Document
        contract={makeContract("DRAFT")}
        parties={PARTIES}
        draft={true}
        reviewStamp={null}
      />
    );
    for (const sheet of sheets(plain.container)) {
      expect(sheet.querySelector(".a4-watermark")).not.toBeNull();
    }
  });

  it("measures the mark into the page budget — the probe footer carries it too", () => {
    const { container } = render(
      <A4Document contract={makeContract()} parties={PARTIES} draft={false} reviewStamp={OFFICIAL} />
    );
    // The hidden measurer renders the SAME footer, so its measured height
    // includes the seal band and body text can never flow into it.
    const measurer = container.querySelector<HTMLElement>(".a4-measurer")!;
    const probeFooter = measurer.querySelector<HTMLElement>(".a4-page-footer")!;
    expect(probeFooter.querySelector("img.a4-seal")).not.toBeNull();
    expect(probeFooter.querySelector("[data-a4-page-official]")).not.toBeNull();
  });
});
