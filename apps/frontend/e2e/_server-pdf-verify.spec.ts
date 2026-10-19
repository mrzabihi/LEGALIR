/**
 * Verifies the SERVER PDF — the artifact a party actually downloads — not the
 * on-screen sheet and not Chrome's print output. The sample contract is
 * fetched through its real owner route, read back with pdfjs, and checked
 * against the six requirements: the identity header (شناسه / تاریخ قرارداد /
 * نسخه + نسخه قالب / وضعیت / SHA-256), the review mark with its REAL fields
 * and disclaimer on every page, the signature table with its four RTL
 * columns, and the absence of any fabricated signature.
 *
 * Read-only: it opens and downloads the seeded sample. Nothing is edited,
 * submitted or deleted.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SAMPLE_REF = "LGL-SAMPLE-1405";
const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const SHOT_DIR = path.join(process.cwd(), "e2e", "__shots__", "server-pdf");

let cachedSessionId: string | null = null;

async function ownerSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sessionId) throw new Error("could not open the sample owner's session");
  cachedSessionId = sessionId;
  return sessionId;
}

async function sampleContract(
  request: APIRequestContext,
  sessionId: string
): Promise<{ id: string; referenceCode: string }> {
  const res = await request.get("/api/v1/property-contracts?pageSize=100", {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    data?: { items?: { id: string; referenceCode: string }[] };
  };
  const row = body.data?.items?.find((i) => i.referenceCode === SAMPLE_REF);
  expect(row, `sample ${SAMPLE_REF} must be listed for its owner`).toBeTruthy();
  return row!;
}

test.describe("server PDF · identity header, review mark, signature table", () => {
  test("every page carries the real header and the review mark", async ({ request }) => {
    const sessionId = await ownerSession(request);
    const sample = await sampleContract(request, sessionId);

    const res = await request.get(`/api/v1/property-contracts/${sample.id}/pdf`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
    });
    expect(res.ok(), `PDF route failed: ${res.status()}`).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("application/pdf");

    const bytes = new Uint8Array(await res.body());
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHOT_DIR, "sample.pdf"), bytes);

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: bytes,
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
    }).promise;

    // pdf-lib writes real Unicode, so Persian survives extraction in
    // LOGICAL order (unlike Chrome's presentation-form glyphs).
    const pages: string[] = [];
    const sizes: { w: number; h: number }[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const text = await page.getTextContent();
      pages.push(
        text.items.map((i) => ("str" in i && typeof i.str === "string" ? i.str : "")).join(" ")
      );
      const view = page.view;
      sizes.push({ w: view[2] ?? 0, h: view[3] ?? 0 });
    }

    // ---- seal + hologram geometry in the REAL PDF ----------------------
    // The screen sheet and the server PDF must agree on size and place:
    // the seal 40mm (113.4pt) tall, the hologram 32mm (90.7pt), and the
    // hologram LEFTMOST at the physical bottom-left of EVERY page. The CTM
    // is tracked through save/restore/transform because an image is painted
    // into the unit square transformed by whatever matrix is current.
    const MM_PT = 72 / 25.4;
    interface ImageDraw {
      page: number;
      w: number;
      h: number;
      x: number;
      y: number;
      rotated: boolean;
    }
    const imageDraws: ImageDraw[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      let m = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let k = 0; k < ops.fnArray.length; k++) {
        const fn = ops.fnArray[k];
        if (fn === pdfjs.OPS.save) {
          stack.push(m.slice());
        } else if (fn === pdfjs.OPS.restore) {
          m = stack.pop() ?? m;
        } else if (fn === pdfjs.OPS.transform) {
          const [a, b, c, d, e, f] = ops.argsArray[k] as [
            number,
            number,
            number,
            number,
            number,
            number,
          ];
          m = [
            m[0]! * a + m[2]! * b,
            m[1]! * a + m[3]! * b,
            m[0]! * c + m[2]! * d,
            m[1]! * c + m[3]! * d,
            m[0]! * e + m[2]! * f + m[4]!,
            m[1]! * e + m[3]! * f + m[5]!,
          ];
        } else if (fn === pdfjs.OPS.paintImageXObject) {
          imageDraws.push({
            page: p,
            w: Math.hypot(m[0]!, m[1]!),
            h: Math.hypot(m[2]!, m[3]!),
            x: m[4]!,
            y: m[5]!,
            rotated: Math.abs(m[1]!) > 0.01 || Math.abs(m[2]!) > 0.01,
          });
        }
      }
    }
    const perPageMarks = Array.from({ length: doc.numPages }, (_, i) => {
      const p = i + 1;
      return {
        page: p,
        seal: imageDraws.find((d) => d.page === p && Math.abs(d.h - 40 * MM_PT) < 1),
        holo: imageDraws.find((d) => d.page === p && Math.abs(d.h - 32 * MM_PT) < 1),
      };
    });
    for (const marks of perPageMarks) {
      expect(marks.seal, `page ${marks.page}: no 40mm seal in the PDF`).toBeTruthy();
      expect(marks.holo, `page ${marks.page}: no 32mm hologram in the PDF`).toBeTruthy();
      // Bottom-left: the hologram starts at the physical left margin, the
      // pair sits in the reserved footer band, hologram left of the seal.
      expect(marks.holo!.x, `page ${marks.page}: hologram x`).toBeLessThanOrEqual(49);
      expect(
        marks.holo!.x + marks.holo!.w,
        `page ${marks.page}: the hologram is not left of the seal`
      ).toBeLessThanOrEqual(marks.seal!.x + 1);
      expect(marks.holo!.y, `page ${marks.page}: hologram y`).toBeLessThan(160);
      expect(marks.seal!.y, `page ${marks.page}: seal y`).toBeLessThan(160);
      // A hand-applied tilt: the seal really is rotated, not axis-aligned.
      expect(marks.seal!.rotated, `page ${marks.page}: the seal is not tilted`).toBe(true);
    }

    const A4_PT = { w: 595.28, h: 841.89 };
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    // Right-aligned RTL lines extract with the VALUE before its label, and
    // the hamza can be split off by a space. Comparing with all whitespace
    // removed tests the real content without pinning the extractor's quirks.
    // ZWNJ and tatweel (the drawn leitmotif in «لیـــــــگالیر») are layout
    // glyphs, not content: strip them too so the comparison is about words.
    const tight = (s: string) => s.replace(/\s+/g, "").replace(/[\u200c\u0640]/g, "");

    // ---- A4, page count ------------------------------------------------
    expect(doc.numPages).toBeGreaterThanOrEqual(1);
    for (const s of sizes) {
      expect(Math.abs(s.w - A4_PT.w) < 2, `page width ${s.w} is not A4`).toBe(true);
      expect(Math.abs(s.h - A4_PT.h) < 2, `page height ${s.h} is not A4`).toBe(true);
    }

    // ---- §5 identity header --------------------------------------------
    const page1 = norm(pages[0]!);
    const page1Tight = tight(page1);
    // Both the label and the REAL reference code are present. The line is
    // right-aligned, so the value extracts before its label.
    expect(page1Tight).toContain("شناسهقرارداد:");
    expect(page1Tight).toContain(sample.referenceCode);
    expect(page1Tight).toContain("تاریخقرارداد:");
    expect(page1Tight).toContain("نسخهقالب:");
    expect(page1Tight).toContain("وضعیت:");
    // The hash in the header is the version's REAL hash — 64 lowercase hex.
    const headerHash = page1.match(/SHA-256: ?([0-9a-f]{64})/);
    expect(headerHash, "the header carries no SHA-256 of the version").toBeTruthy();

    // ---- §3 review mark on EVERY page, with REAL fields + disclaimer ---
    for (let i = 0; i < pages.length; i++) {
      const text = tight(pages[i]!);
      expect(text, `page ${i + 1}: the review mark is missing`).toContain("لیگالیر");
      expect(text, `page ${i + 1}: «تاریخ بررسی» is missing`).toContain("تاریخبررسی:");
      expect(text, `page ${i + 1}: «بررسی‌کننده» is missing`).toContain("بررسیکننده:");
      expect(text, `page ${i + 1}: «شناسه بررسی» is missing`).toContain("شناسهبررسی:");
      // The disclaimer is mandatory and verbatim. The hamza in
      // «نشان‌دهندهٔ» is re-ordered by the PDF text extractor, so the
      // comparison starts after it — everything else must match exactly.
      expect(text, `page ${i + 1}: the disclaimer is missing`).toContain(
        tight(
          "بررسی داخلی لیگالیر است و به‌معنای مهر دادگاه، دفترخانه، سازمان ثبت یا تأیید قطعی حقوقی نیست."
        )
      );
    }

    // ---- §6 signature table, RTL four columns --------------------------
    // §T7 puts annexed sheets and the authenticity certificate AFTER the
    // contract body, so the signature block closes the BODY — find it by
    // its heading instead of assuming it is the file's last page.
    const signaturePageText = pages.map(tight).find((t) => t.includes("امضایطرفین"));
    expect(signaturePageText, "the signature block is missing").toBeTruthy();
    const lastPageTight = signaturePageText!;
    for (const header of ["نقش", "نامکامل", "محلامضا", "وضعیتامضا"]) {
      expect(lastPageTight, `the signature table has no «${header}» column`).toContain(header);
    }

    // ---- honest signatures: the printed state is the RECORDED state -----
    // Cross-check the sheet against the lifecycle API. A signature that was
    // never recorded must never be printed as real, and a recorded one must
    // not be hidden.
    const lifecycleRes = await request.get(
      `/api/v1/property-contracts/${sample.id}/lifecycle`,
      { headers: { cookie: `${SESSION_COOKIE}=${sessionId}` } }
    );
    expect(lifecycleRes.ok()).toBeTruthy();
    const lifecycle = (await lifecycleRes.json()) as {
      data?: {
        signatureRequest?: {
          contractVersionId: string;
          participants: { roleFa: string; status: string; signedAt: string | null }[];
        } | null;
      };
    };
    const participants = lifecycle.data?.signatureRequest?.participants ?? [];
    expect(participants.length, "the sample has no signature request").toBeGreaterThanOrEqual(2);

    // The sheet prints exactly the stored status per role.
    const STATUS_FA: Record<string, string> = {
      SIGNED: "امضاشده",
      VIEWED: "مشاهدهشده",
      PENDING: "درانتظارامضا",
      INVITED: "دعوتشده",
      DECLINED: "ردشده",
      EXPIRED: "منقضیشده",
    };
    for (const participant of participants) {
      const label = STATUS_FA[participant.status];
      expect(label, `unknown participant status ${participant.status}`).toBeTruthy();
      expect(
        lastPageTight,
        `«${participant.roleFa}» is stored as ${participant.status} but the sheet disagrees`
      ).toContain(label!);
      if (participant.signedAt) {
        expect(lastPageTight, "a recorded signature has no printed date").toContain("تاریخامضا:");
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          pages: doc.numPages,
          sizes,
          marks: perPageMarks.map((m) => ({
            page: m.page,
            seal: m.seal ? { w: +m.seal.w.toFixed(1), h: +m.seal.h.toFixed(1), x: +m.seal.x.toFixed(1), y: +m.seal.y.toFixed(1) } : null,
            hologram: m.holo ? { w: +m.holo.w.toFixed(1), h: +m.holo.h.toFixed(1), x: +m.holo.x.toFixed(1), y: +m.holo.y.toFixed(1) } : null,
          })),
          headerHash: headerHash?.[1],
          participants: participants.map((p) => ({ role: p.roleFa, status: p.status })),
        },
        null,
        2
      )
    );

  });

  /**
   * The second render path: a SCHEMA-DRIVEN type (cloud IaaS), whose clauses
   * and tables come from the registry instead of hand-written builders. The
   * header, the A4 page and the honest draft mark must be identical — an
   * unapproved version is watermarked on every page and carries NO review
   * mark, whatever template produced it.
   */
  test("a schema-driven template gets the same header and an honest draft mark", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    const sessionId = await ownerSession(request);
    const cookie = `${SESSION_COOKIE}=${sessionId}`;
    const created = await request.post("/api/v1/property-contracts", {
      headers: { cookie },
      data: { type: "cloud_iaas", title: "قرارداد خدمات ابری — IaaS (آزمون PDF)" },
    });
    expect(created.ok(), `create failed: ${created.status()}`).toBeTruthy();
    const contract = ((await created.json()) as {
      data?: { id?: string; referenceCode?: string };
    }).data;
    expect(contract?.id && contract.referenceCode).toBeTruthy();

    try {
      const money = (toman: number) => ({ amount: toman * 10, currency: "IRR" });
      const values: Record<string, unknown> = {
        serviceName: "زیرساخت ابری سازمانی",
        serviceDescription: "ارائهٔ ماشین مجازی، شبکه و ذخیره‌سازی اختصاصی",
        hostingRegion: "تهران — دیتاسنتر داخلی",
        contractStartDate: "2026-10-01",
        contractTermMonths: 12,
        computeSpecs: "۸ هسته، ۳۲ گیگابایت حافظه",
        storageSpecs: "۵۰۰ گیگابایت SSD",
        networkSpecs: "۱ گیگابیت بر ثانیه",
        backupPolicy: "پشتیبان‌گیری روزانه با نگهداری ۳۰ روزه",
        availabilitySla: 99.9,
        supportHours: "۲۴×۷",
        responseTime: "حداکثر ۳۰ دقیقه",
        maintenanceWindow: "سه‌شنبه ۰۲:۰۰ تا ۰۴:۰۰",
        securityMeasures: "رمزنگاری داده در حالت سکون و انتقال",
        uptimePenalty: money(20_000_000),
        subscriptionFee: money(120_000_000),
        billingPeriod: "monthly",
        paymentMethod: "bank_transfer",
        usageBilling: "مصرف مازاد بر سهمیه، ماهانه صورت‌حساب می‌شود.",
        customerObligations: "مشتری مسئول مدیریت دسترسی کاربران خود است.",
        providerObligations: "ارائه‌دهنده متعهد به حفظ دسترس‌پذیری مطابق SLA است.",
        terminationNoticeDays: 30,
        terminationTerms: "هر طرف می‌تواند با ۳۰ روز اطلاع کتبی قرارداد را فسخ کند.",
        dataOwnership: "customer",
        dataRetentionDays: 90,
        dataReturnMethod: "خروجی کامل به‌صورت آرشیو رمزنگاری‌شده",
      };
      const patched = await request.patch(`/api/v1/property-contracts/${contract!.id}`, {
        headers: { cookie },
        data: { data: { schemaVersion: 1, values, customClauses: [] }, currentStep: "review" },
      });
      expect(patched.ok(), `patch failed: ${patched.status()}`).toBeTruthy();

      const parties = [
        {
          role: "provider",
          personKind: "legal",
          nationality: "iranian",
          identity: {
            firstName: "شرکت ابر آریا",
            lastName: "",
            companyRegistrationNumber: "123456",
            address: "تهران، خیابان ولیعصر، پلاک ۱۰",
            mobile: "09120000003",
          },
        },
        {
          role: "customer",
          personKind: "natural",
          nationality: "iranian",
          identity: {
            firstName: "رضا",
            lastName: "کریمی",
            nationalId: "0087654321",
            mobile: "09120000004",
            address: "کرج، خیابان شهید بهشتی، پلاک ۴",
          },
        },
      ];
      for (const party of parties) {
        const res = await request.put(
          `/api/v1/property-contracts/${contract!.id}/parties`,
          { headers: { cookie }, data: party }
        );
        expect(res.ok(), `party failed: ${res.status()}`).toBeTruthy();
      }

      // Freezing the content is what creates an artifact to download.
      const versioned = await request.post(
        `/api/v1/property-contracts/${contract!.id}/versions`,
        { headers: { cookie } }
      );
      expect(versioned.ok(), `version failed: ${versioned.status()} ${await versioned.text()}`).toBeTruthy();
      const version = ((await versioned.json()) as {
        data?: { version?: { id: string; versionNumber: number; documentHash: string } };
      }).data?.version;
      expect(version?.documentHash).toMatch(/^[0-9a-f]{64}$/);

      const pdfRes = await request.get(
        `/api/v1/property-contracts/${contract!.id}/pdf`,
        { headers: { cookie } }
      );
      expect(pdfRes.ok(), `PDF route failed: ${pdfRes.status()}`).toBeTruthy();
      expect(pdfRes.headers()["content-type"]).toContain("application/pdf");

      const bytes = new Uint8Array(await pdfRes.body());
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      fs.writeFileSync(path.join(SHOT_DIR, "cloud-iaas-draft.pdf"), bytes);

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjs.getDocument({
        data: bytes,
        disableFontFace: true,
        isEvalSupported: false,
        useSystemFonts: false,
      }).promise;

      const pages: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const text = await page.getTextContent();
        pages.push(
          text.items.map((i) => ("str" in i && typeof i.str === "string" ? i.str : "")).join(" ")
        );
        const view = page.view;
        expect(Math.abs((view[2] ?? 0) - 595.28) < 2, `page ${p} width`).toBe(true);
        expect(Math.abs((view[3] ?? 0) - 841.89) < 2, `page ${p} height`).toBe(true);
      }

      const tight = (s: string) => s.replace(/\s+/g, "").replace(/[\u200c\u0640]/g, "");
      const page1 = tight(pages[0]!);
      // The identity header is template-independent and carries REAL data.
      expect(page1).toContain("شناسهقرارداد:");
      expect(page1).toContain(contract!.referenceCode);
      expect(page1).toContain("تاریخقرارداد:");
      expect(page1).toContain("نسخهقالب:");
      expect(page1).toContain("وضعیت:");
      const hash = pages[0]!.match(/SHA-256: ?([0-9a-f]{64})/);
      expect(hash?.[1], "the header hash is not the version's own hash").toBe(
        version!.documentHash
      );
      // Every page says «پیش‌نویس» and NO page claims a review.
      for (let i = 0; i < pages.length; i++) {
        expect(tight(pages[i]!), `page ${i + 1} has no draft watermark`).toContain(
          tight("پیش‌نویس ـ تأییدنشده")
        );
        expect(
          tight(pages[i]!),
          `page ${i + 1} shows a review mark on an unapproved version`
        ).not.toContain("تاریخبررسی:");
      }
      // The four-column RTL signature table closes the document.
      const lastPage = tight(pages[pages.length - 1]!);
      for (const header of ["نقش", "نامکامل", "محلامضا", "وضعیتامضا"]) {
        expect(lastPage, `the signature table has no «${header}» column`).toContain(header);
      }
    } finally {
      await request.delete(`/api/v1/property-contracts/${contract!.id}`, {
        headers: { cookie },
      });
    }
  });
});
