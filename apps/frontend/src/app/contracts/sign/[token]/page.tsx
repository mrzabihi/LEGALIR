// ============================================================
// LEGALIR — Public Signature Invitation Page
// ============================================================
// The destination of the link in a signature SMS. The recipient has no
// LEGALIR session; the TOKEN is their credential and it identifies one
// recipient and one frozen contract version.
//
// What the recipient gets, in this order:
//
//   ۱. the contract DOCUMENT itself (A4, same engine as the drafter's
//      preview and the PDF), with a «پیش‌نویس» watermark until the
//      contract is finalized;
//   ۲. three OPTIONAL choices — ask LEGALIR's legal AI, refer to a
//      specialised lawyer, or continue straight to signing. None of
//      them is compulsory and none blocks the signature;
//   ۳. the signature action (one-time SMS code) or a recorded refusal.
//
// The page never shows another party's data or signature state, and it
// never edits the text: a review produces an opinion the drafter must
// explicitly accept, which is what creates a new version.
//
// LEGAL NOTE: this is «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { formatIsoJalali } from "@/lib/contracts/dates";
import { IconCheck, IconContract, IconLawBook, IconChat, IconWarning } from "@/lib/icons";
import {
  A4Document,
  type A4DocumentMeta,
  type A4SignatureMark,
} from "@/components/contracts/document/a4-document";
import type { RenderedContract } from "@/lib/contracts/template";
import { Button } from "@legalir/ui";

interface DocumentPayload {
  rendered: RenderedContract;
  meta: A4DocumentMeta;
  versionNumber: number;
  documentHash: string;
  /** Derived server-side from the contract state — never from the UI. */
  draft: boolean;
  stateFa: string;
  /** Only THIS recipient's own signature state. */
  signatureMarks: Record<string, A4SignatureMark>;
}

interface InvitationInfo {
  referenceCode: string;
  typeFa: string;
  title: string;
  roleFa: string;
  recipientMasked: string;
  expiresAt: string;
  verifyBeforeView: boolean;
  status: string;
  participantStatus: string | null;
  canSign: boolean;
  onlineSigningAllowed: boolean;
  signingPolicyNoteFa: string;
  document: DocumentPayload | null;
  pdfHref: string | null;
}

type Phase = "idle" | "code_sent" | "signed" | "declined";

const BASE = "/api/v1/contract-invitations";

type ReviewOutcome =
  | { kind: "ai"; summaryFa: string }
  | { kind: "lawyer"; matched: boolean; lawyerNameFa: string | null }
  | { kind: "note" };

export default function SignInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const url = `${BASE}/${encodeURIComponent(token)}`;

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [reason, setReason] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<"sms" | "dev-console" | "none">("none");

  const [note, setNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [review, setReview] = useState<ReviewOutcome | null>(null);
  const signRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const body = (await res.json().catch(() => null)) as
        | { data: InvitationInfo }
        | { message?: string }
        | null;
      if (!res.ok || !body || !("data" in body)) {
        throw new Error(
          (body && "message" in body && body.message) || "این دعوت‌نامه معتبر نیست."
        );
      }
      setInfo(body.data);
      if (body.data.participantStatus === "SIGNED") setPhase("signed");
      // Acknowledge receipt so the drafter sees «مشاهده شد». Idempotent
      // and it does NOT consume the link.
      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      }).catch(() => undefined);
    } catch (err) {
      setError((err as Error)?.message ?? "خطا در بازکردن دعوت‌نامه");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  /** POST an action to the token-scoped endpoint and unwrap the envelope. */
  const act = useCallback(
    async (
      payload: Record<string, unknown>
    ): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as
        | { data: unknown }
        | { message?: string }
        | null;
      if (!res.ok) {
        return {
          ok: false,
          message: (body && "message" in body && body.message) || "عملیات ناموفق بود",
        };
      }
      return { ok: true, data: body && "data" in body ? body.data : null };
    },
    [url]
  );

  async function requestCode() {
    setBusy(true);
    setError(null);
    const res = await act({ action: "request_otp" });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    const data = res.data as { mobileMasked?: string; channel?: "sms" | "dev-console" } | null;
    setMasked(data?.mobileMasked ?? info?.recipientMasked ?? null);
    setOtpChannel(data?.channel ?? "none");
    setPhase("code_sent");
  }

  async function verifyCode() {
    if (!consent) return setError("برای امضا باید رضایت خود را اعلام کنید.");
    if (code.trim().length < 4) return setError("کد تأیید را وارد کنید.");
    setBusy(true);
    setError(null);
    const res = await act({ action: "verify_otp", code: code.trim(), consentGiven: true });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setPhase("signed");
  }

  async function decline() {
    setBusy(true);
    setError(null);
    const res = await act({ action: "decline", reason: reason.trim() || undefined });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setPhase("declined");
  }

  async function askReview(kind: "ai" | "lawyer") {
    setReviewBusy(true);
    setError(null);
    const res = await act({
      action: "request_review",
      reviewKind: kind,
      note: note.trim() || undefined,
    });
    setReviewBusy(false);
    if (!res.ok) return setError(res.message);
    const data = res.data as
      | { summaryFa?: string; matched?: boolean; lawyerNameFa?: string | null }
      | null;
    if (kind === "ai") {
      setReview({ kind: "ai", summaryFa: data?.summaryFa ?? "" });
    } else {
      setReview({
        kind: "lawyer",
        matched: data?.matched ?? false,
        lawyerNameFa: data?.lawyerNameFa ?? null,
      });
    }
    setNote("");
  }

  async function saveNote() {
    if (!note.trim()) return;
    setReviewBusy(true);
    setError(null);
    const res = await act({ action: "request_review", note: note.trim() });
    setReviewBusy(false);
    if (!res.ok) return setError(res.message);
    setReview({ kind: "note" });
    setNote("");
  }

  function continueToSign() {
    signRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const doc = info?.document ?? null;

  return (
    <main id="main-content" className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto max-w-[900px] px-4 py-8 tablet:py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-large bg-primary-container text-primary-on flex items-center justify-center shrink-0">
            <IconContract className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-h3 text-on-surface">دعوت به امضای قرارداد</h1>
            <p className="text-caption text-muted">لیگالیر — تأیید و امضای الکترونیکی</p>
          </div>
        </div>

        {loading ? (
          <Card>
            <p className="text-body-2 text-muted text-center">در حال بررسی دعوت‌نامه…</p>
          </Card>
        ) : error && !info ? (
          <Card>
            <div className="text-center">
              <IconWarning className="w-8 h-8 text-warning mx-auto mb-3" />
              <h2 className="text-titleSmall text-on-surface mb-1">دعوت‌نامه قابل استفاده نیست</h2>
              <p className="text-body-2 text-muted">
                {error ?? "این دعوت‌نامه معتبر نیست یا منقضی شده است."}
              </p>
            </div>
          </Card>
        ) : !info ? null : (
          <div className="space-y-4">
            <Card>
              <h2 className="text-titleSmall text-on-surface mb-4">مشخصات دعوت‌نامه</h2>
              <dl className="space-y-3">
                <Row label="عنوان قرارداد" value={info.title || info.typeFa} />
                <Row label="نوع" value={info.typeFa} />
                <Row label="کد پیگیری" value={info.referenceCode} mono />
                <Row label="نقش شما" value={info.roleFa} />
                <Row label="شماره شما" value={masked ?? info.recipientMasked} mono />
                <Row label="مهلت" value={formatIsoJalali(info.expiresAt.slice(0, 10))} />
                {doc && (
                  <>
                    <Row label="نسخه سند" value={`نسخه ${doc.versionNumber}`} />
                    <Row label="وضعیت سند" value={doc.draft ? "پیش‌نویس" : "نهایی‌شده"} />
                  </>
                )}
              </dl>
              {doc && (
                <p className="mt-3 text-caption text-muted break-all" dir="ltr">
                  SHA-256: {doc.documentHash}
                </p>
              )}
            </Card>

            {phase === "signed" ? (
              <StatusCard
                tone="success"
                title="امضای شما ثبت شد"
                body="امضای الکترونیکی شما روی همین نسخهٔ قرارداد ثبت شد. پس از امضای همهٔ طرفین و تأیید نهایی، نسخهٔ رسمی صادر می‌شود."
              />
            ) : phase === "declined" ? (
              <StatusCard
                tone="warning"
                title="امضای شما ثبت نشد"
                body="خودداری شما از امضا ثبت شد. در صورت نیاز، صاحب قرارداد می‌تواند دوباره برای شما دعوت‌نامه‌ای تازه صادر کند."
              />
            ) : !info.onlineSigningAllowed ? (
              <Card>
                <div className="text-center">
                  <IconWarning className="w-7 h-7 text-warning mx-auto mb-3" />
                  <h3 className="text-titleSmall text-on-surface mb-1">
                    امضای آنلاین برای این نوع قرارداد فعال نیست
                  </h3>
                  <p className="text-body-2 text-muted">{info.signingPolicyNoteFa}</p>
                </div>
              </Card>
            ) : !info.canSign ? (
              <StatusCard
                tone="warning"
                title="این دعوت‌نامه دیگر قابل امضا نیست"
                body="ممکن است مهلت آن تمام شده یا نسخهٔ تازه‌ای از قرارداد صادر شده باشد. برای دریافت لینک تازه با صاحب قرارداد هماهنگ کنید."
              />
            ) : null}

            {/* The document itself — the same A4 engine as the preview
                and the PDF, so what is read here is what is signed. */}
            {doc && (
              <div className="space-y-2">
                <h2 className="text-titleMedium text-on-surface px-1">متن قرارداد</h2>
                {doc.draft && (
                  <p className="text-caption text-muted px-1">
                    این سند پیش‌نویس است و تا امضای همهٔ طرفین و تأیید نهایی، سند رسمی محسوب
                    نمی‌شود.
                  </p>
                )}
                <A4Document
                  rendered={doc.rendered}
                  meta={doc.meta}
                  draft={doc.draft}
                  stateFa={doc.stateFa}
                  versionNumber={doc.versionNumber}
                  documentHash={doc.documentHash}
                  signatureMarks={doc.signatureMarks}
                  includeLegalBasis={false}
                  pdfHref={info.pdfHref ?? undefined}
                  showActions
                />
              </div>
            )}

            {/* Optional review — never compulsory, never blocking. */}
            {info.canSign && phase === "idle" && (
              <Card>
                <h2 className="text-titleSmall text-on-surface mb-1">بررسی اختیاری پیش از امضا</h2>
                <p className="text-body-2 text-muted mb-3">
                  هیچ‌کدام از این دو مسیر اجباری نیست و امضا را متوقف نمی‌کند. نتیجهٔ بررسی، متن
                  قرارداد را به‌صورت خودکار تغییر نمی‌دهد.
                </p>

                <div className="grid grid-cols-1 tablet:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => void askReview("ai")}
                    className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
                      <IconChat className="w-4 h-4 text-primary" />
                      پرسش از هوش مصنوعی حقوقی
                    </span>
                    <span className="block mt-1 text-caption text-muted">
                      تحلیل از دید شما؛ جایگزین نظر وکیل نیست.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => void askReview("lawyer")}
                    className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
                      <IconLawBook className="w-4 h-4 text-primary" />
                      ارجاع به وکیل متخصص
                    </span>
                    <span className="block mt-1 text-caption text-muted">
                      درخواست بررسی حقوقی؛ نتیجه به تنظیم‌کننده هم اطلاع داده می‌شود.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={continueToSign}
                    className="rounded-medium border border-divider p-3 text-right hover:state-hover transition-colors"
                  >
                    <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
                      <IconCheck className="w-4 h-4 text-primary" />
                      ادامه بدون بررسی برای امضا
                    </span>
                    <span className="block mt-1 text-caption text-muted">
                      مستقیم به بخش امضا بروید.
                    </span>
                  </button>
                </div>

                <div className="mt-4">
                  <label className="block text-body-2 text-muted mb-1" htmlFor="party-note">
                    یادداشت برای تنظیم‌کننده (اختیاری)
                  </label>
                  <textarea
                    id="party-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-medium border border-divider bg-surface text-on-surface"
                    placeholder="نظر یا ابهام خود دربارهٔ این نسخه را بنویسید…"
                  />
                  <Button
                    size="small"
                    variant="secondary"
                    className="mt-2"
                    disabled={reviewBusy || !note.trim()}
                    onClick={() => void saveNote()}
                  >
                    ثبت یادداشت
                  </Button>
                </div>

                {review && (
                  <div className="mt-3 rounded-medium border border-divider p-3">
                    {review.kind === "ai" && (
                      <>
                        <p className="text-labelLarge text-on-surface mb-1">
                          تحلیل هوش مصنوعی (جایگزین نظر وکیل نیست)
                        </p>
                        <p className="text-body-2 text-on-surface whitespace-pre-line">
                          {review.summaryFa}
                        </p>
                      </>
                    )}
                    {review.kind === "lawyer" && (
                      <p className="text-body-2 text-on-surface">
                        {review.matched && review.lawyerNameFa
                          ? `درخواست بررسی برای ${review.lawyerNameFa} ثبت شد.`
                          : "درخواست بررسی حقوقی ثبت شد؛ در حال یافتن وکیل متخصص."}
                      </p>
                    )}
                    {review.kind === "note" && (
                      <p className="text-body-2 text-on-surface">
                        یادداشت شما برای تنظیم‌کننده ثبت شد.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Signature */}
            <div ref={signRef}>
              {info.canSign && phase !== "signed" && phase !== "declined" && (
                <Card>
                  {phase === "idle" ? (
                    <>
                      <h2 className="text-titleSmall text-on-surface mb-1">
                        تأیید و امضای الکترونیکی
                      </h2>
                      <p className="text-body-2 text-on-surface-variant mb-3">
                        متنی که خواندید همان نسخهٔ تثبیت‌شده‌ای است که امضا می‌کنید. یک کد
                        یک‌بارمصرف به شمارهٔ ثبت‌شدهٔ شما ارسال می‌شود.
                      </p>
                      <Button onClick={() => void requestCode()} loading={busy}>
                        ارسال کد تأیید و امضا
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-titleSmall text-on-surface mb-1">کد تأیید را وارد کنید</h3>
                      <p className="text-caption text-muted mb-3">
                        {otpChannel === "sms"
                          ? `کد به شمارهٔ ${masked ?? info.recipientMasked} پیامک شد.`
                          : "کد تأیید در محیط توسعه در کنسول سرور ثبت شد (پیامک واقعی ارسال نشده است)."}
                      </p>

                      <label className="block text-body-2 text-muted mb-1" htmlFor="otp-code">
                        کد تأیید
                      </label>
                      <input
                        id="otp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full h-11 px-3 mb-4 rounded-medium border border-divider bg-surface text-on-surface font-mono tracking-widest text-center"
                        placeholder="------"
                      />

                      <label className="flex items-start gap-2 text-body-2 text-on-surface-variant mb-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          تأیید می‌کنم متن همین نسخه را خوانده‌ام و با امضای الکترونیکی آن
                          موافقم. این امضا «تأیید و امضای الکترونیکی» است و جایگزین امضای دستی
                          در دفاتر رسمی نیست.
                        </span>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void verifyCode()} loading={busy}>
                          ثبت امضا
                        </Button>
                        <Button variant="outlined" onClick={() => void requestCode()} disabled={busy}>
                          ارسال دوباره کد
                        </Button>
                      </div>

                      <div className="mt-5 pt-4 border-t border-divider">
                        <label className="block text-body-2 text-muted mb-1" htmlFor="decline-reason">
                          خودداری از امضا (اختیاری)
                        </label>
                        <textarea
                          id="decline-reason"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 mb-2 rounded-medium border border-divider bg-surface text-on-surface"
                          placeholder="دلیل خودداری را بنویسید…"
                        />
                        <Button
                          variant="danger-outlined"
                          disabled={busy}
                          onClick={() => void decline()}
                        >
                          از امضا خودداری می‌کنم
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              )}
            </div>

            {error ? (
              <Card>
                <p className="text-body-2 text-error">{error}</p>
              </Card>
            ) : null}

            <Card>
              <p className="text-caption text-muted">{info.signingPolicyNoteFa}</p>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-large bg-surface p-5 shadow-elevation-1 border border-divider">
      {children}
    </div>
  );
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: "success" | "warning";
  title: string;
  body: string;
}) {
  const isSuccess = tone === "success";
  return (
    <Card>
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <IconCheck className="w-6 h-6 text-success shrink-0 mt-0.5" />
        ) : (
          <IconWarning className="w-6 h-6 text-warning shrink-0 mt-0.5" />
        )}
        <div>
          <h3 className="text-titleSmall text-on-surface">{title}</h3>
          <p className="text-body-2 mt-1 text-muted">{body}</p>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-body-2 text-muted shrink-0">{label}</dt>
      <dd className={`text-body-2 text-on-surface text-left ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
