// ============================================================
// LEGALIR — Public Contract Verification Page
// ============================================================
// The destination of the QR code printed on a finalized contract.
// Anyone holding the printed document can open this URL and confirm
// the contract is genuine — no session required.
//
// It shows ONLY what the public verification endpoint exposes: the
// reference code, type, version, finalize date, party display names,
// the document hash and the registration-policy status. It never
// claims that Legalier transferred ownership — official registration
// is a separate, notary-performed act.
// ============================================================

"use client";

import { use, useEffect, useState } from "react";
import type { ContractVerificationInfo } from "@legalir/types";
import { fetchVerification } from "@/lib/api/property-contracts";
import { formatIsoJalali } from "@/lib/contracts/dates";
import { IconCheck, IconContract, IconShield } from "@/lib/icons";

export default function VerifyContractPage({
  params,
}: {
  params: Promise<{ publicVerificationId: string }>;
}) {
  const { publicVerificationId } = use(params);

  const [info, setInfo] = useState<ContractVerificationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVerification(publicVerificationId)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error)?.message ?? "خطا در تأیید سند");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicVerificationId]);

  return (
    <main id="main-content" className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto max-w-2xl px-4 py-10 tablet:py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-large bg-primary-container text-primary-on flex items-center justify-center shrink-0">
            <IconShield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-h3 text-on-surface">تأیید اصالت سند</h1>
            <p className="text-caption text-muted">لیگالیر — سامانه تأیید عمومی قرارداد</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
            <div className="text-body-2 text-muted">در حال بررسی سند…</div>
          </div>
        ) : error || !info ? (
          <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-h3 text-on-surface mb-2">سندی یافت نشد</h2>
            <p className="text-body-2 text-muted">
              {error ?? "شناسه تأیید نامعتبر است یا سند هنوز نهایی نشده است."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Genuine banner */}
            <div className="rounded-large bg-success-50 border border-success/30 p-5 flex items-start gap-3">
              <IconCheck className="w-6 h-6 text-success-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-titleSmall text-success-900">این سند در لیگالیر ثبت شده است</h2>
                <p className="text-body-2 text-success-800 mt-1">
                  محتوای سند با اثر انگشت دیجیتال زیر مطابقت دارد و پس از نهایی‌سازی تغییر نکرده است.
                </p>
              </div>
            </div>

            {/* Document facts */}
            <div className="rounded-large bg-surface p-5 shadow-elevation-1 border border-divider">
              <div className="flex items-center gap-2 mb-4">
                <IconContract className="w-5 h-5 text-primary" />
                <h3 className="text-titleSmall text-on-surface">مشخصات سند</h3>
              </div>

              <dl className="space-y-3">
                <Row label="کد پیگیری" value={info.referenceCode} mono />
                <Row label="نوع قرارداد" value={info.typeFa} />
                <Row label="نسخه" value={`نسخه ${info.versionNumber}`} />
                <Row label="تاریخ نهایی‌سازی" value={formatIsoJalali(info.finalizedAt.slice(0, 10))} />
                <Row label="وضعیت" value={info.statusFa} />
                {info.partyNames.length > 0 && (
                  <Row label="طرفین" value={info.partyNames.join("، ")} />
                )}
              </dl>

              <div className="mt-4 pt-4 border-t border-divider">
                <p className="text-labelSmall text-muted mb-1">اثر انگشت سند (SHA-256)</p>
                <p className="font-mono text-caption text-on-surface break-all" dir="ltr">
                  {info.documentHash}
                </p>
              </div>
            </div>

            {/* Legal boundary — never claim ownership transfer */}
            <div className="rounded-large bg-info-50 border border-info/30 p-5">
              <h3 className="text-titleSmall text-info-900 mb-1">ثبت رسمی</h3>
              <p className="text-body-2 text-info-800">
                نهایی‌سازی در لیگالیر به معنای انتقال رسمی مالکیت نیست. انتقال مالکیت ملک تنها با ثبت
                سند در دفتر اسناد رسمی و به نام خریدار انجام می‌شود. وضعیت «{info.statusFa}» صرفاً
                مرحله سند در این سامانه را نشان می‌دهد.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
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
