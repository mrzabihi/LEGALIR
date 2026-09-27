"use client";

// ============================================================
// LEGALIR — Lawyer picker (wizard step 3)
// ============================================================
// Two ways to reach a lawyer, both converging on the same selection:
//
//   · a lawyer was already chosen (Path A) → show them, offer «تغییر وکیل»
//   · no lawyer yet (Path B)              → match against the real
//     marketplace and let the user pick from the candidates
//
// Only real data is shown: verification status, specialties, city,
// availability and the actual consultation fee. No invented rating, no
// "online now" badge, and no fabricated match score — the engine's
// ranking is used to ORDER candidates, never displayed as a number.
// ============================================================

import { useState } from "react";
import { Button, SelectableCard, TextField, Select } from "@legalir/ui";
import { useLawyers, useMatchLawyers } from "@/hooks/useLawyers";
import { LawyerAvatar } from "@/components/lawyers/lawyer-avatar";
import { LawyerAvailabilityBadge } from "@/components/lawyers/lawyer-availability-badge";
import { availabilityView } from "@/lib/lawyers/availability";
import { IconSearch, IconRefresh, IconInfo } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { LEGAL_CATEGORY_FA, type LawyerListItem } from "@legalir/types";
import { formatToman } from "./consultation-status";

interface LawyerPickerProps {
  category: string;
  description: string;
  selectedLawyerId: string | null;
  onSelect: (lawyer: LawyerListItem) => void;
  onClear: () => void;
}

/** A compact, honest summary row for one candidate. */
function CandidateCard({
  lawyer,
  selected,
  onSelect,
}: {
  lawyer: LawyerListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const location = lawyer.locations[0];
  const years = lawyer.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
  const specialty = lawyer.specializations[0];
  const view = availabilityView(
    lawyer.availabilityStatus,
    lawyer.consultationCapacity,
    lawyer.acceptingRequests
  );

  return (
    <SelectableCard
      selected={selected}
      onClick={onSelect}
      icon={
        <LawyerAvatar
          name={lawyer.fullName}
          avatarUrl={lawyer.avatarUrl}
          avatarType={lawyer.avatarType}
          size={40}
        />
      }
      title={
        <span className="flex flex-wrap items-center gap-2">
          {lawyer.fullName}
          {lawyer.isDemo && (
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-muted">
              نمونه
            </span>
          )}
        </span>
      }
      description={
        <span className="block space-y-1">
          <span className="block">
            {lawyer.professionalTitle ??
              (specialty ? LEGAL_CATEGORY_FA[specialty.category] ?? specialty.category : "وکیل")}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
            {years > 0 && <span>{toPersianNumber(years)} سال تجربه</span>}
            {location && <span>{location.city}</span>}
            <span>{formatToman(lawyer.pricing.consultationFeeToman)}</span>
          </span>
          <span className="block pt-1">
            <LawyerAvailabilityBadge view={view} />
          </span>
        </span>
      }
    />
  );
}

export function LawyerPicker({
  category,
  description,
  selectedLawyerId,
  onSelect,
  onClear,
}: LawyerPickerProps) {
  const [mode, setMode] = useState<"browse" | "match">("browse");
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");

  const browse = useLawyers({ category: category || undefined, search: search || undefined });
  const match = useMatchLawyers();

  const candidates: LawyerListItem[] =
    mode === "match"
      ? (match.data?.candidates ?? []).map((c) => c.lawyer)
      : (browse.data?.items ?? []);

  function runMatch() {
    match.mutate({
      category,
      description: description || null,
      province: province || null,
    });
  }

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("browse")}
          className={[
            "rounded-full px-3.5 py-1.5 text-caption font-medium transition",
            mode === "browse"
              ? "bg-primary text-white"
              : "bg-surface-container text-muted hover:text-on-surface",
          ].join(" ")}
        >
          مرور وکلا
        </button>
        <button
          type="button"
          onClick={() => setMode("match")}
          className={[
            "rounded-full px-3.5 py-1.5 text-caption font-medium transition",
            mode === "match"
              ? "bg-primary text-white"
              : "bg-surface-container text-muted hover:text-on-surface",
          ].join(" ")}
        >
          پیشنهاد بر اساس موضوع
        </button>
      </div>

      {mode === "browse" ? (
        <div className="grid grid-cols-1 gap-3 mobile-l:grid-cols-2">
          <TextField
            id="lawyer-search"
            label="جست‌وجوی نام وکیل"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<IconSearch size={18} />}
            fullWidth
          />
          <Select
            id="lawyer-province"
            label="استان"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            options={[
              { value: "", label: "همه استان‌ها" },
              { value: "تهران", label: "تهران" },
              { value: "اصفهان", label: "اصفهان" },
              { value: "فارس", label: "فارس" },
              { value: "خراسان رضوی", label: "خراسان رضوی" },
            ]}
            fullWidth
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-caption text-muted">
            بر اساس موضوع و شرح شما، وکلای واجد شرایط از میان پروفایل‌های واقعی مرتب می‌شوند.
            انتخاب نهایی با شماست.
          </p>
          <Button
            variant="tonal"
            onClick={runMatch}
            loading={match.isPending}
            startIcon={<IconSearch size={18} />}
          >
            یافتن وکلای مناسب
          </Button>
        </div>
      )}

      {/* Loading / error / empty */}
      {mode === "browse" && browse.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-large bg-surface-container" />
          ))}
        </div>
      )}

      {mode === "browse" && browse.isError && (
        <div className="flex flex-col items-center gap-2 rounded-large bg-error/10 p-5 text-center">
          <p className="text-body-2 text-error">خطا در بارگذاری وکلا</p>
          <button
            type="button"
            onClick={() => browse.refetch()}
            className="inline-flex items-center gap-1.5 text-body-2 text-primary hover:underline"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        </div>
      )}

      {mode === "match" && match.isError && (
        <div className="rounded-large bg-error/10 p-5 text-center text-body-2 text-error">
          یافتن وکیل ناموفق بود. دوباره تلاش کنید.
        </div>
      )}

      {mode === "match" && match.data && match.data.candidates.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-large border border-divider/60 bg-surface p-6 text-center">
          <IconInfo size={26} className="text-muted" />
          <p className="text-body-2 text-muted">
            وکیل واجد شرایطی برای این موضوع یافت نشد.
          </p>
          <p className="text-caption text-muted">
            می‌توانید درخواست را ثبت کنید تا تیم پشتیبانی وکیل مناسب را به شما معرفی کند.
          </p>
        </div>
      )}

      {/* Candidates */}
      {candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.map((l) => (
            <CandidateCard
              key={l.id}
              lawyer={l}
              selected={selectedLawyerId === l.id}
              onSelect={() => onSelect(l)}
            />
          ))}
        </div>
      )}

      {selectedLawyerId && (
        <button
          type="button"
          onClick={onClear}
          className="text-caption text-muted transition hover:text-error"
        >
          حذف انتخاب وکیل
        </button>
      )}
    </div>
  );
}
