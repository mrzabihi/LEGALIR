// ============================================================
// LEGALIR — Admin · Lawyers (وکلا)
// ============================================================
// The lawyer verification queue. Every lawyer carries an explicit
// verification state; a profile that has merely been *submitted* is never
// shown as verified (the lawyer platform is not live). A reviewer decides
// VERIFIED / REJECTED / SUSPENDED, and the decision is audited server-side.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useAdminLawyers, useDecideLawyerVerification, useAdminMe } from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { LAWYER_VERIFICATION_FA, LEGAL_CATEGORY_FA } from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  IdChip,
  FilterPills,
  InfoBanner,
} from "@/components/admin/ui";

const STATUS_ORDER = [
  "UNDER_REVIEW",
  "DOCUMENTS_SUBMITTED",
  "PROFILE_SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
  "UNVERIFIED",
] as const;

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "brand"> = {
  UNVERIFIED: "neutral",
  PROFILE_SUBMITTED: "info",
  DOCUMENTS_SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

export default function AdminLawyersPage() {
  const { can } = useAdminMe();
  const canReview = can("admin:lawyer:verify");

  const [status, setStatus] = useState<string>("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useAdminLawyers(status || undefined);
  const decide = useDecideLawyerVerification();

  const filters = useMemo(
    () => [
      { value: "", label: "همه" },
      ...STATUS_ORDER.map((s) => ({ value: s, label: LAWYER_VERIFICATION_FA[s] })),
    ],
    []
  );

  async function onDecide(id: string, next: string, note?: string) {
    setFeedback(null);
    setBusyId(id);
    try {
      await decide.mutateAsync({ id, status: next, note });
      setFeedback({
        tone: "success",
        text: `وضعیت تأیید وکیل به «${LAWYER_VERIFICATION_FA[next as keyof typeof LAWYER_VERIFICATION_FA] ?? next}» تغییر کرد.`,
      });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "تغییر وضعیت ناموفق بود";
      setFeedback({ tone: "error", text: message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="وکلا"
        description="صف تأیید وکلای پلتفرم. پروفایل‌هایی که فقط ارسال شده‌اند به‌عنوان تأییدشده نمایش داده نمی‌شوند."
      />

      {!canReview && (
        <InfoBanner tone="warning">
          شما مجوز بررسی و تأیید وکلا را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {feedback && (
        <div
          className={`mb-4 rounded-large border p-3 text-body-2 ${
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mb-4">
        <FilterPills options={filters} value={status} onChange={setStatus} />
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="وکیلی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>نام</Th>
                  <Th>پروانه</Th>
                  <Th>وضعیت تأیید</Th>
                  <Th>تخصص</Th>
                  <Th>ثبت</Th>
                  {canReview && <Th>عملیات</Th>}
                </tr>
              }
            >
              {data.items.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium text-on-surface">
                        {l.fullName}
                        {l.isDemo && (
                          <Badge tone="neutral" title="پروفایل نمونه / داده توسعه">
                            نمونه
                          </Badge>
                        )}
                      </span>
                      <IdChip id={l.id} />
                    </div>
                  </Td>
                  <Td>
                    {l.licenseNumber ? (
                      <span className="tabular-nums" dir="ltr">
                        {l.licenseNumber}
                        {l.licenseYear ? ` / ${toPersianNumber(l.licenseYear)}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONES[l.verificationStatus] ?? "neutral"}>
                      {LAWYER_VERIFICATION_FA[
                        l.verificationStatus as keyof typeof LAWYER_VERIFICATION_FA
                      ] ?? l.verificationStatus}
                    </Badge>
                  </Td>
                  <Td>
                    {l.specializations.length > 0 ? (
                      <span className="text-caption text-muted">
                        {l.specializations
                          .slice(0, 3)
                          .map((s) => LEGAL_CATEGORY_FA[s.category] ?? s.category)
                          .join("، ")}
                        {l.specializations.length > 3 ? " …" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(l.createdAt)}</Td>
                  {canReview && (
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyId === l.id || l.verificationStatus === "VERIFIED"}
                          onClick={() => onDecide(l.id, "VERIFIED")}
                        >
                          تأیید
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === l.id || l.verificationStatus === "REJECTED"}
                          onClick={() => onDecide(l.id, "REJECTED")}
                        >
                          رد
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === l.id || l.verificationStatus === "SUSPENDED"}
                          onClick={() => onDecide(l.id, "SUSPENDED")}
                        >
                          تعلیق
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </DataTable>

            <div className="mt-3 text-caption text-muted">{toPersianNumber(data.total)} وکیل</div>
          </>
        )}
      </StateView>
    </div>
  );
}
