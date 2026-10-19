// ============================================================
// LEGALIR — Admin contract stage derivation (pure)
// ============================================================
// The «مراحل و گردش کار قرارداد» table in the admin drawer must show the
// REAL stages this contract has actually walked — never a fixed template
// reused for every type. The list is therefore built from three real
// sources, in this order:
//
//   1. the type's OWN completeness sections (rent and sale and every
//      schema-driven type declare different sections), one row each;
//   2. the internal legal review (the `contract-admin-reviews` row);
//   3. the signing authorisation actually bound to the current hash
//      (a `legalir_review` approval or a `self_final` registration);
//   4. the party signature request and each party's own status;
//   5. the frozen final version and its stored artifact;
//   6. the official LEGALIR seal + hologram.
//
// Everything is DERIVED from rows the caller reads; nothing is stored
// here and no stage is ever invented. A stage that does not exist for
// this contract type simply does not appear.
//
// The module is pure so the derivation can be unit-tested without a DB,
// and so the same function can later serve any other read surface.
// ============================================================

import type {
  ContractAdminReviewStatus,
  ContractRegistrationPath,
  ContractStageAction,
  ContractStageRow,
  ContractStageStatus,
  ContractStagesView,
  PropertyContractState,
  SignatureRequestStatus,
} from "@legalir/types";
import { CONTRACT_STAGE_STATUS_FA } from "@legalir/types";

// ------------------------------------------------------------
// Input — the real facts, read by the route
// ------------------------------------------------------------

export interface StageSectionFact {
  key: string;
  labelFa: string;
  percent: number;
  missing: string[];
}

export interface StageReviewFact {
  status: ContractAdminReviewStatus;
  submittedAt: string;
  decidedAt: string | null;
  reasonFa: string;
  reviewerLabelFa: string | null;
  /** TRUE when `currentVersionApproval` returns THIS row for the current hash. */
  validForCurrentVersion: boolean;
}

export interface StageRegistrationFact {
  path: ContractRegistrationPath;
  createdAt: string;
  actorLabelFa: string;
  reasonFa: string;
}

export interface StageSignatureFact {
  status: SignatureRequestStatus;
  createdAt: string;
  completedAt: string | null;
  participants: { roleFa: string; status: string; signedAt: string | null }[];
}

export interface StageStampFact {
  applied: boolean;
  appliedAt: string | null;
  approvedByLabelFa: string | null;
  pending: boolean;
  requestedAt: string | null;
  /** The server's own verdict for the NEXT stamp action. */
  canRequest: boolean;
  canApply: boolean;
  blockingFa: string | null;
  /** TRUE when a request exists but is bound to a different version hash. */
  staleRequest: boolean;
}

export interface AdminStageInput {
  sections: StageSectionFact[];
  state: PropertyContractState;
  /** The contract row's own last change — the only per-section time that exists. */
  contractUpdatedAt: string;
  currentVersionCreatedAt: string | null;
  review: StageReviewFact | null;
  registration: StageRegistrationFact | null;
  signatures: StageSignatureFact | null;
  finalVersion: { versionNumber: number; finalizedAt: string | null } | null;
  finalDocument: { uploadedAt: string } | null;
  printIssueCount: number;
  stamp: StageStampFact;
  /** The permissions the CALLER holds — an action is disabled, never hidden. */
  permissions: {
    review: boolean;
    /** `admin:contracts:review` — what the advance-signing endpoint requires. */
    registerSelfFinal: boolean;
    resendInvitations: boolean;
    manageStamp: boolean;
  };
  /** §T4 — the route's own read of whether signing can be advanced now. */
  canAdvanceToSigning: boolean;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const PRE_REVIEW_STATES: PropertyContractState[] = [
  "DRAFT",
  "PARTIES_PENDING",
  "PROPERTY_PENDING",
  "DOCUMENTS_PENDING",
  "TERMS_PENDING",
  "CHANGES_REQUESTED",
];

const PATH_FA: Record<ContractRegistrationPath, string> = {
  legalir_review: "بررسی حقوقی لیگالیر",
  self_final: "ثبت نهایی بدون بررسی",
};

function action(
  id: ContractStageAction["id"],
  labelFa: string,
  enabled: boolean,
  reasonFa: string | null
): ContractStageAction {
  return { id, labelFa, enabled, reasonFa: enabled ? null : reasonFa };
}

function row(params: {
  index: number;
  key: string;
  titleFa: string;
  status: ContractStageStatus;
  responsibleFa: string;
  updatedAt: string | null;
  noteFa: string | null;
  percent?: number | null;
  missingFa?: string[];
  detailFa?: string | null;
  actions?: ContractStageAction[];
}): ContractStageRow {
  return {
    key: params.key,
    index: params.index,
    titleFa: params.titleFa,
    status: params.status,
    statusFa: CONTRACT_STAGE_STATUS_FA[params.status],
    responsibleFa: params.responsibleFa,
    updatedAt: params.updatedAt,
    noteFa: params.noteFa,
    percent: params.percent ?? null,
    missingFa: params.missingFa ?? [],
    detailFa: params.detailFa ?? null,
    actions: params.actions ?? [],
  };
}

// ------------------------------------------------------------
// The derivation
// ------------------------------------------------------------

export function buildAdminStages(input: AdminStageInput): ContractStagesView {
  const rows: ContractStageRow[] = [];

  // --- 1. The type's own information sections -------------------------
  for (const section of input.sections) {
    const complete = section.percent === 100;
    rows.push(
      row({
        index: rows.length + 1,
        key: `section:${section.key}`,
        titleFa: section.labelFa,
        status: complete ? "done" : "needs_fix",
        responsibleFa: "سازندهٔ قرارداد (کاربر)",
        // No per-section timestamp exists in the store; using the row's
        // own `updatedAt` is the truthful answer, never a fabricated time.
        updatedAt: input.contractUpdatedAt,
        noteFa: complete ? null : `تکمیل‌نشده — ${section.missing.length} مورد باقی است.`,
        percent: section.percent,
        missingFa: section.missing,
        detailFa: complete
          ? "همهٔ اطلاعات لازم این بخش ثبت شده است."
          : `اطلاعات ناقص: ${section.missing.join("، ")}`,
      })
    );
  }

  // --- 2. Internal legal review --------------------------------------
  const selfFinalPath = input.registration?.path === "self_final";
  rows.push(reviewRow(input, rows.length + 1, selfFinalPath));

  // --- 3. The signing authorisation actually bound to this hash ------
  rows.push(authorisationRow(input, rows.length + 1));

  // --- 4. Party signatures -------------------------------------------
  rows.push(signatureRow(input, rows.length + 1));

  // --- 5. Final version + stored artifact ----------------------------
  rows.push(finalRow(input, rows.length + 1));

  // --- 6. Official seal + hologram -----------------------------------
  rows.push(stampRow(input, rows.length + 1));

  const doneCount = rows.filter((r) => r.status === "done" || r.status === "skipped").length;
  const current =
    rows.find(
      (r) =>
        r.status === "active" ||
        r.status === "needs_fix" ||
        r.status === "blocked" ||
        r.status === "rejected"
    ) ??
    rows[rows.length - 1] ??
    null;

  return {
    rows,
    currentKey: current?.key ?? null,
    doneCount,
    totalCount: rows.length,
  };
}

function reviewRow(input: AdminStageInput, index: number, selfFinalPath: boolean): ContractStageRow {
  const base = {
    index,
    key: "review",
    titleFa: "بررسی و تأیید داخلی لیگالیر",
    responsibleFa: "واحد بررسی حقوقی لیگالیر",
    actions: [
      action(
        "review_decision",
        "ثبت تصمیم بررسی",
        input.permissions.review && input.review?.status === "PENDING",
        !input.permissions.review
          ? "برای ثبت تصمیم بررسی، مجوز «بررسی قراردادها» لازم است."
          : input.review?.status !== "PENDING"
            ? "درخواست بررسیِ بازی برای تصمیم‌گیری وجود ندارد."
            : null
      ),
    ],
  };

  const review = input.review;
  if (!review) {
    if (selfFinalPath) {
      return row({
        ...base,
        status: "skipped",
        updatedAt: input.registration?.createdAt ?? null,
        noteFa:
          "این قرارداد با مسیر «ثبت نهایی بدون بررسی» به مرحلهٔ امضا رسیده و بررسی حقوقی روی آن انجام نشده است.",
        detailFa:
          input.registration?.reasonFa ??
          "مسیر ثبت نهایی بدون بررسی لیگالیر انتخاب شده است؛ نشان بررسی حقوقی روی سند درج نمی‌شود.",
      });
    }
    return row({
      ...base,
      status: PRE_REVIEW_STATES.includes(input.state) ? "pending" : "blocked",
      updatedAt: null,
      noteFa: "هنوز درخواست بررسی برای این نسخه ثبت نشده است.",
      detailFa:
        "برای ورود به صف بررسی، قرارداد باید از مسیر کاربر «ارسال برای بررسی» شود و نسخهٔ تثبیت‌شده داشته باشد.",
    });
  }

  const status: ContractStageStatus =
    review.status === "PENDING"
      ? "active"
      : review.status === "APPROVED"
        ? review.validForCurrentVersion
          ? "done"
          : "needs_fix"
        : review.status === "CHANGES_REQUESTED"
          ? "needs_fix"
          : review.status === "REJECTED"
            ? "rejected"
            : "blocked";

  const note =
    review.status === "APPROVED" && !review.validForCurrentVersion
      ? "تأیید این بررسی برای نسخهٔ فعلی معتبر نیست؛ محتوا پس از تأیید تغییر کرده است."
      : review.reasonFa.trim() || null;

  return row({
    ...base,
    status,
    updatedAt: review.decidedAt ?? review.submittedAt,
    noteFa: note,
    detailFa: review.reviewerLabelFa
      ? `تصمیم: ${review.reviewerLabelFa}`
      : review.status === "PENDING"
        ? "در انتظار تصمیم واحد بررسی حقوقی."
        : null,
  });
}

function authorisationRow(input: AdminStageInput, index: number): ContractStageRow {
  // ONE real operation exists at this stage: the `advance-signing` endpoint,
  // which records the `self_final` path and moves the contract to signing.
  // Labelling it twice («پیشبرد» + «ثبت نهایی بدون بررسی») would offer two
  // buttons for the same request — and one of them would name a path the
  // endpoint does not take. The reasons below are the endpoint's own
  // preconditions, in the order it checks them.
  const actions = [
    action(
      "register_self_final",
      "ثبت مسیر امضا بدون بررسی لیگالیر",
      input.permissions.registerSelfFinal && input.canAdvanceToSigning,
      !input.permissions.registerSelfFinal
        ? "ثبت مسیر امضا فقط با مجوز «بررسی قراردادها» ممکن است."
        : input.signatures !== null
          ? "درخواست امضا برای این قرارداد صادر شده است؛ تغییر مسیر دیگر ممکن نیست."
          : input.registration !== null
            ? "برای این نسخه پیش‌تر مسیر ثبت تعیین شده است."
            : input.review?.validForCurrentVersion
              ? "مبنای صدور این نسخه از مسیر بررسی داخلی تأیید شده است؛ ثبت مسیر بدون بررسی لازم نیست."
              : input.canAdvanceToSigning
                ? null
                : "در وضعیت فعلی یا با محتوای قابل چاپ فعلی، ثبت مسیر امضا ممکن نیست."
    ),
  ];

  if (input.registration) {
    return row({
      index,
      key: "authorisation",
      titleFa: "مبنای صدور برای مرحلهٔ امضا",
      status: "done",
      responsibleFa: input.registration.actorLabelFa,
      updatedAt: input.registration.createdAt,
      noteFa: `مسیر: ${PATH_FA[input.registration.path]}`,
      detailFa: input.registration.reasonFa,
      actions,
    });
  }

  if (input.review?.validForCurrentVersion) {
    return row({
      index,
      key: "authorisation",
      titleFa: "مبنای صدور برای مرحلهٔ امضا",
      status: "done",
      responsibleFa: input.review.reviewerLabelFa ?? "واحد بررسی حقوقی لیگالیر",
      updatedAt: input.review.decidedAt ?? input.review.submittedAt,
      noteFa: `مسیر: ${PATH_FA.legalir_review}`,
      detailFa: "تأیید بررسی داخلی، به اثر انگشت همین نسخه گره خورده است.",
      actions,
    });
  }

  if (input.currentVersionCreatedAt === null) {
    return row({
      index,
      key: "authorisation",
      titleFa: "مبنای صدور برای مرحلهٔ امضا",
      status: "pending",
      responsibleFa: "واحد بررسی حقوقی لیگالیر",
      updatedAt: null,
      noteFa: "نسخهٔ تثبیت‌شده‌ای برای صدور وجود ندارد.",
      actions,
    });
  }

  return row({
    index,
    key: "authorisation",
    titleFa: "مبنای صدور برای مرحلهٔ امضا",
    status: "pending",
    responsibleFa: "واحد بررسی حقوقی لیگالیر",
    updatedAt: null,
    noteFa: "پس از تأیید بررسی داخلی، مسیر صدور به همین نسخه گره می‌خورد.",
    detailFa: "بدون مبنای معتبر، مرحلهٔ امضا آغاز نمی‌شود.",
    actions,
  });
}

function signatureRow(input: AdminStageInput, index: number): ContractStageRow {
  const actions = [
    action(
      "resend_invitations",
      "ارسال دوبارهٔ لینک امضا",
      input.permissions.resendInvitations &&
        input.signatures !== null &&
        input.signatures.participants.some((p) => p.status !== "SIGNED"),
      !input.permissions.resendInvitations
        ? "برای ارسال لینک امضا مجوز لازم است."
        : input.signatures === null
          ? "هنوز درخواست امضایی برای این قرارداد صادر نشده است."
          : input.signatures.participants.every((p) => p.status === "SIGNED")
            ? "همهٔ طرفین امضا کرده‌اند؛ ارسال دوباره لازم نیست."
            : null
    ),
  ];

  const s = input.signatures;
  if (!s) {
    return row({
      index,
      key: "signatures",
      titleFa: "امضای طرفین",
      status: "pending",
      responsibleFa: "طرفین قرارداد",
      updatedAt: null,
      noteFa: "درخواست امضا صادر نشده است.",
      detailFa: "پس از انتخاب مبنای صدور، لینک امضا برای هر طرف ارسال می‌شود.",
      actions,
    });
  }

  const signed = s.participants.filter((p) => p.status === "SIGNED");
  const declined = s.participants.filter((p) => p.status === "DECLINED");
  const last = s.completedAt ?? latestOf(s.participants.map((p) => p.signedAt)) ?? s.createdAt;

  let status: ContractStageStatus;
  if (s.status === "COMPLETED") status = "done";
  else if (s.status === "DECLINED") status = "rejected";
  else if (s.status === "CANCELLED" || s.status === "EXPIRED") status = "blocked";
  else if (signed.length > 0) status = "active";
  else status = "pending";

  const note =
    declined.length > 0
      ? `رد امضا توسط: ${declined.map((p) => p.roleFa).join("، ")}`
      : `${signed.length} از ${s.participants.length} طرف امضا کرده‌اند.`;

  return row({
    index,
    key: "signatures",
    titleFa: "امضای طرفین",
    status,
    responsibleFa: "طرفین قرارداد",
    updatedAt: last,
    noteFa: note,
    detailFa: s.participants
      .map((p) => `${p.roleFa}: ${p.signedAt ? "امضا شده" : "در انتظار"}`)
      .join(" — "),
    actions,
  });
}

function finalRow(input: AdminStageInput, index: number): ContractStageRow {
  const actions = [
    action(
      "view_final_pdf",
      "مشاهدهٔ سند نهایی",
      input.finalDocument !== null,
      input.finalDocument === null ? "سند نهایی هنوز تولید نشده است." : null
    ),
  ];

  if (input.finalDocument) {
    return row({
      index,
      key: "final",
      titleFa: "نسخهٔ نهایی و سند قابل چاپ",
      status: "done",
      responsibleFa: "لیگالیر",
      updatedAt: input.finalDocument.uploadedAt,
      noteFa: "نسخهٔ نهایی قفل و سند چاپی ذخیره شده است.",
      detailFa: input.printIssueCount
        ? `${input.printIssueCount} مورد قابل چاپ نیست و باید پیش از توزیع بررسی شود.`
        : "همهٔ محتوای قرارداد در فایل نهایی قابل چاپ است.",
      actions,
    });
  }

  if (input.finalVersion) {
    return row({
      index,
      key: "final",
      titleFa: "نسخهٔ نهایی و سند قابل چاپ",
      status: "needs_fix",
      responsibleFa: "لیگالیر",
      updatedAt: input.finalVersion.finalizedAt,
      noteFa: `نسخه ${input.finalVersion.versionNumber} نهایی شده اما فایل چاپی ذخیره نشده است.`,
      detailFa:
        input.printIssueCount > 0
          ? `${input.printIssueCount} مورد قابل چاپ نیست و تولید فایل را ناموفق کرده است.`
          : "تولید فایل نهایی می‌تواند از همین نسخه دوباره انجام شود.",
      actions,
    });
  }

  return row({
    index,
    key: "final",
    titleFa: "نسخهٔ نهایی و سند قابل چاپ",
    status: "pending",
    responsibleFa: "لیگالیر",
    updatedAt: null,
    noteFa: "پس از امضای همهٔ طرفین و تأیید نهایی، نسخهٔ نهایی قفل می‌شود.",
    detailFa: "فایل نهایی، تصویر دقیق همان نسخهٔ امضاشده است.",
    actions,
  });
}

function stampRow(input: AdminStageInput, index: number): ContractStageRow {
  const s = input.stamp;
  const actions = [
    action(
      "stamp_action",
      s.pending ? "تصمیم روی درخواست مهر" : "اقدام مهر",
      input.permissions.manageStamp && (s.canApply || s.canRequest),
      !input.permissions.manageStamp
        ? "اقدام مهر فقط با مجوز «مدیریت مهر رسمی قراردادها» و در اختیار مدیر ارشد است."
        : s.blockingFa
    ),
  ];

  if (s.applied) {
    return row({
      index,
      key: "stamp",
      titleFa: "مهر و هولوگرام رسمی لیگالیر",
      status: "done",
      responsibleFa: s.approvedByLabelFa ?? "مدیر ارشد لیگالیر",
      updatedAt: s.appliedAt,
      noteFa: "مهر رسمی و هولوگرام روی نسخهٔ فعلی درج شده است.",
      detailFa: "مهر به اثر انگشت این نسخه و به بایت‌های فایل مهر گره خورده است.",
      actions,
    });
  }

  if (s.pending) {
    return row({
      index,
      key: "stamp",
      titleFa: "مهر و هولوگرام رسمی لیگالیر",
      status: s.staleRequest ? "needs_fix" : "active",
      responsibleFa: "مدیر ارشد لیگالیر",
      updatedAt: s.requestedAt,
      noteFa: s.staleRequest
        ? "درخواست مهرِ باز به نسخهٔ دیگری گره خورده است؛ باید لغو و برای نسخهٔ فعلی تازه ثبت شود."
        : "درخواست مهر ثبت شده و در انتظار تصمیم است.",
      detailFa: s.blockingFa,
      actions,
    });
  }

  return row({
    index,
    key: "stamp",
    titleFa: "مهر و هولوگرام رسمی لیگالیر",
    status: s.canRequest ? "active" : "blocked",
    responsibleFa: "مدیر ارشد لیگالیر",
    updatedAt: null,
    noteFa: s.canRequest ? "شرایط ثبت درخواست مهر فراهم است." : "درخواست مهر هنوز قابل ثبت نیست.",
    detailFa: s.blockingFa,
    actions,
  });
}

function latestOf(values: (string | null)[]): string | null {
  const present = values.filter((v): v is string => v !== null);
  return present.length === 0 ? null : (present.sort().at(-1) ?? null);
}
