// ============================================================
// LEGALIR — /contracts/sign/[token] carries the OFFICIAL mark
// ============================================================
// A signer may have no account at all, so the session-scoped owner
// routes are closed to them — yet the PDF their token downloads already
// has the seal and hologram drawn on every page. This test pins that the
// on-screen sheet reads the mark from the invitation payload and paints
// it in the footer of every page, so the party signs what they see.
//
// It also pins the mutual exclusion the PDF and DOCX renderers apply:
// a version carrying no review mark shows the draft watermark; a version
// carrying a review mark never does. The page gets `draft` from the
// contract state and `stamp` from the server, and must not print both.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CONTRACT_DRAFT_WATERMARK_FA } from "@legalir/types";
import { getContractDefinition } from "@/lib/contracts/registry";
import { renderContract } from "@/lib/contracts/template";
import SignInvitationPage from "@/app/contracts/sign/[token]/page";

const TOKEN = "raw-invitation-token";
const SEAL_HREF = `/api/v1/contract-invitations/${TOKEN}/stamp-asset/seal`;
const HOLOGRAM_HREF = `/api/v1/contract-invitations/${TOKEN}/stamp-asset/hologram`;

function payload(stamp: unknown) {
  const data = getContractDefinition("property_rent").createDefaultData("apartment");
  const rendered = renderContract(
    {
      id: "ctr-1",
      referenceCode: "LGL-RENT-1405-000001",
      type: "property_rent",
      typeFa: "اجاره‌نامه",
      title: "اجاره‌نامه آپارتمان",
      data,
      createdAt: "2026-01-01T00:00:00.000Z",
    } as never,
    [
      {
        id: "pty-1",
        contractId: "ctr-1",
        role: "landlord",
        roleFa: "موجر",
        identity: {
          firstName: "مریم",
          lastName: "محمدی",
          fatherName: "علی",
          nationalId: "0012345678",
          birthCertificateNumber: "1234",
          birthCertificatePlace: "تهران",
          birthDate: null,
          mobile: "09121110001",
          address: "تهران",
          postalCode: "1234567890",
        },
      },
      {
        id: "pty-2",
        contractId: "ctr-1",
        role: "tenant",
        roleFa: "مستأجر",
        identity: {
          firstName: "رضا",
          lastName: "کریمی",
          fatherName: "علی",
          nationalId: "0012345679",
          birthCertificateNumber: "1235",
          birthCertificatePlace: "تهران",
          birthDate: null,
          mobile: "09121110002",
          address: "تهران",
          postalCode: "1234567890",
        },
      },
    ] as never,
    []
  );

  return {
    data: {
      referenceCode: "LGL-RENT-1405-000001",
      typeFa: "اجاره‌نامه",
      title: "اجاره‌نامه آپارتمان",
      roleFa: "مستأجر",
      recipientMasked: "0912***0002",
      expiresAt: "2026-12-31T00:00:00.000Z",
      verifyBeforeView: true,
      status: "ACTIVE",
      participantStatus: "PENDING",
      canSign: true,
      onlineSigningAllowed: true,
      signingPolicyNoteFa: "",
      document: {
        rendered,
        meta: {
          typeFa: "اجاره‌نامه",
          referenceCode: "LGL-RENT-1405-000001",
          contractDateIso: "2026-01-01T00:00:00.000Z",
          templateVersion: "1.0.0",
        },
        versionNumber: 1,
        documentHash: "a".repeat(64),
        draft: true,
        stateFa: "ADMIN_APPROVED",
        signatureMarks: {},
      },
      stamp,
      pdfHref: `/api/v1/contract-invitations/${TOKEN}/pdf`,
    },
  };
}

async function renderWith(payloadBody: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/stamp-asset/")) {
        // The images themselves are covered by the route test; here the
        // assertion is WHETHER the page points at them.
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response(JSON.stringify(payloadBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );

  // The page unwraps `params` with React's `use()`, so the first render
  // suspends on the thenable. `act` flushes that microtask before the
  // assertions run; without it every query sees the fallback.
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <Suspense fallback={<p>suspending</p>}>
        <SignInvitationPage params={Promise.resolve({ token: TOKEN })} />
      </Suspense>
    );
  });
  // The document sheet appears only after the invitation resolves.
  await waitFor(() => expect(screen.getByText("متن قرارداد")).toBeTruthy());
  return view;
}

function pages(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".a4-pages-inner .a4-page"));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/contracts/sign/[token] — the signer's sheet", () => {
  it("paints the official seal and hologram in every page footer", async () => {
    const { container } = await renderWith(
      payload({
        applied: true,
        official: true,
        sealHref: SEAL_HREF,
        hologramHref: HOLOGRAM_HREF,
        reviewId: "arev-1",
        reviewedAt: "2026-01-05T10:00:00.000Z",
        reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
        approvedByLabelFa: "مدیر ارشد لیگالیر",
        approvedAt: "2026-01-05T10:57:29.000Z",
      })
    );

    const sheets = pages(container);
    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      const footer = sheet.querySelector<HTMLElement>(".a4-page-footer")!;
      expect(footer).not.toBeNull();
      const seal = footer.querySelector<HTMLImageElement>("img.a4-seal");
      const hologram = footer.querySelector<HTMLImageElement>("img.a4-hologram");
      // The hrefs are the TOKEN-scoped routes: a signer has no session,
      // so the owner route would 401 and leave a broken image.
      expect(seal?.getAttribute("src")).toBe(SEAL_HREF);
      expect(hologram?.getAttribute("src")).toBe(HOLOGRAM_HREF);
    }
    // A stamped document never shows the draft watermark.
    expect(container.querySelector(".a4-watermark")).toBeNull();
  });

  it("shows only the internal review mark when no official stamp is bound", async () => {
    const { container } = await renderWith(
      payload({
        applied: true,
        official: false,
        reviewId: "arev-1",
        reviewedAt: "2026-01-04T10:00:00.000Z",
        reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
        reviewerInitials: "م.م",
      })
    );

    expect(container.querySelector(".a4-review-stamp")).not.toBeNull();
    // No official seal is claimed…
    expect(container.querySelector("img.a4-seal")).toBeNull();
    // …and the page does not print the watermark beside a review mark.
    expect(container.querySelector(".a4-watermark")).toBeNull();
  });

  it("keeps the draft watermark while no review mark exists", async () => {
    const { container } = await renderWith(payload({ applied: false }));

    expect(container.querySelector(".a4-review-stamp")).toBeNull();
    const sheets = pages(container);
    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      expect(sheet.textContent).toContain(CONTRACT_DRAFT_WATERMARK_FA);
    }
  });
});
