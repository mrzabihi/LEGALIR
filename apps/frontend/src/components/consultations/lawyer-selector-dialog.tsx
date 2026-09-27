"use client";

// ============================================================
// LEGALIR — Drill-down lawyer selector (consultation preview)
// ============================================================
// The «تغییر وکیل» affordance on the final preview opens this. It is a
// three-level drill-down over the REAL lawyer directory:
//
//   1. تخصص      — only specialties that actually have lawyers, with counts
//   2. وکلا       — the lawyers who practise that specialty (+ search)
//   3. تأیید      — the chosen lawyer's profile, then an explicit confirm
//
// Nothing is hard-coded: the specialty list is derived from the union of
// every lawyer's `specializations`, and each row shows only data the
// directory actually carries (name, specialties, city, fee, availability).
// No invented rating, no "online now" badge, no fabricated match score.
//
// The current lawyer stays selected until the user confirms a replacement.
// Closing or cancelling leaves the draft untouched.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, SelectableCard, TextField } from "@legalir/ui";
import { useLawyers } from "@/hooks/useLawyers";
import { LawyerAvatar } from "@/components/lawyers/lawyer-avatar";
import { LawyerAvailabilityBadge } from "@/components/lawyers/lawyer-availability-badge";
import { availabilityView } from "@/lib/lawyers/availability";
import { IconArrowBack, IconCheck, IconClose, IconInfo, IconRefresh, IconSearch } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { LEGAL_CATEGORY_FA, type LawyerListItem } from "@legalir/types";
import { formatToman } from "./consultation-status";

interface LawyerSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called only after the user explicitly confirms a replacement. */
  onConfirm: (lawyer: LawyerListItem) => void;
  /** The lawyer currently on the preview — highlighted, never auto-replaced. */
  currentLawyerId: string | null;
}

type Level = "specialty" | "list" | "confirm";

/**
 * The specialty slugs a lawyer practises that have a user-facing Persian
 * label. A lawyer may carry internal tags outside the canonical category
 * vocabulary (`LEGAL_CATEGORY_FA`); those are not browsable specialties and
 * must never surface as a raw English slug in the Persian UI.
 */
function labeledSpecialtySlugs(lawyer: LawyerListItem): string[] {
  return lawyer.specializations
    .map((s) => s.category)
    .filter((slug) => slug in LEGAL_CATEGORY_FA);
}

/** The Persian labels for a lawyer's browsable specialties. */
function specialtyLabels(lawyer: LawyerListItem): string[] {
  return labeledSpecialtySlugs(lawyer).map((slug) => LEGAL_CATEGORY_FA[slug]!);
}

/** A compact, honest row for one lawyer in the list level. */
function LawyerRow({
  lawyer,
  current,
  onPick,
}: {
  lawyer: LawyerListItem;
  current: boolean;
  onPick: () => void;
}) {
  const location = lawyer.locations[0];
  const years = lawyer.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
  const view = availabilityView(
    lawyer.availabilityStatus,
    lawyer.consultationCapacity,
    lawyer.acceptingRequests
  );

  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        "flex w-full items-start gap-3 rounded-large border-2 p-3.5 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/40",
        current
          ? "border-control-selected-border bg-control-selected-surface"
          : "border-control-unselected-border bg-control-unselected-bg hover:border-control-selected/40",
      ].join(" ")}
    >
      <LawyerAvatar
        name={lawyer.fullName}
        avatarUrl={lawyer.avatarUrl}
        avatarType={lawyer.avatarType}
        size={44}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-labelLarge text-on-surface">{lawyer.fullName}</span>
          {lawyer.isDemo && (
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-muted">
              نمونه
            </span>
          )}
          {current && (
            <span className="rounded-full bg-control-selected/15 px-2 py-0.5 text-caption font-medium text-control-selected">
              انتخاب فعلی
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-caption text-muted">
          {lawyer.professionalTitle ?? specialtyLabels(lawyer).join("، ")}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          {years > 0 && <span>{toPersianNumber(years)} سال تجربه</span>}
          {location && <span>{location.city}</span>}
          <span>{formatToman(lawyer.pricing.consultationFeeToman)}</span>
        </span>
        <span className="mt-1.5 block">
          <LawyerAvailabilityBadge view={view} />
        </span>
      </span>
    </button>
  );
}

export function LawyerSelectorDialog({
  open,
  onClose,
  onConfirm,
  currentLawyerId,
}: LawyerSelectorDialogProps) {
  const [level, setLevel] = useState<Level>("specialty");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<LawyerListItem | null>(null);

  // One fetch of the real directory; the specialty list and every filter
  // below are derived from it, so there is no hard-coded specialty list and
  // no per-specialty round trip.
  const { data, isLoading, isError, refetch } = useLawyers({ pageSize: 100 });
  const all = useMemo(() => data?.items ?? [], [data]);

  // Reset to the first level every time the dialog opens, so a cancelled
  // selection never leaks into the next open.
  useEffect(() => {
    if (open) {
      setLevel("specialty");
      setSpecialty(null);
      setSearch("");
      setPending(null);
    }
  }, [open]);

  // Specialties that actually have at least one lawyer, most-populated first.
  const specialties = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of all) {
      for (const slug of labeledSpecialtySlugs(l)) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([slug, count]) => ({ slug, count, label: LEGAL_CATEGORY_FA[slug]! }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fa"));
  }, [all]);

  const inSpecialty = useMemo(() => {
    if (!specialty) return [];
    const q = search.trim();
    return all.filter((l) => {
      if (!labeledSpecialtySlugs(l).includes(specialty)) return false;
      if (!q) return true;
      return (
        l.fullName.includes(q) ||
        (l.professionalTitle ?? "").includes(q) ||
        specialtyLabels(l).some((label) => label.includes(q))
      );
    });
  }, [all, specialty, search]);

  function pick(lawyer: LawyerListItem) {
    setPending(lawyer);
    setLevel("confirm");
  }

  function confirm() {
    if (!pending) return;
    onConfirm(pending);
    onClose();
  }

  const title =
    level === "specialty"
      ? "انتخاب وکیل — تخصص"
      : level === "list"
        ? `وکلای ${specialty ? (LEGAL_CATEGORY_FA[specialty] ?? specialty) : ""}`
        : "تأیید وکیل";

  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidth="lg">
      {/* ---- Level 1: specialties ---- */}
      {level === "specialty" && (
        <div className="space-y-3">
          <p className="text-body-2 text-muted">
            تخصص مورد نظر را انتخاب کنید تا وکلای همان حوزه نمایش داده شوند.
          </p>

          {isLoading && (
            <div className="grid grid-cols-1 gap-2 mobile-l:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-large bg-surface-container" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-2 rounded-large bg-error/10 p-5 text-center">
              <p className="text-body-2 text-error">خطا در بارگذاری فهرست وکلا</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 text-body-2 text-primary hover:underline"
              >
                <IconRefresh size={16} />
                تلاش مجدد
              </button>
            </div>
          )}

          {!isLoading && !isError && specialties.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-large border border-divider/60 p-6 text-center">
              <IconInfo size={26} className="text-muted" />
              <p className="text-body-2 text-muted">وکیلی در فهرست موجود نیست.</p>
            </div>
          )}

          {!isLoading && !isError && specialties.length > 0 && (
            <div className="grid grid-cols-1 gap-2 mobile-l:grid-cols-2">
              {specialties.map((s) => (
                <SelectableCard
                  key={s.slug}
                  title={s.label}
                  description={`${toPersianNumber(s.count)} وکیل`}
                  onClick={() => {
                    setSpecialty(s.slug);
                    setSearch("");
                    setLevel("list");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Level 2: lawyers in the specialty ---- */}
      {level === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setLevel("specialty")}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-caption text-primary transition hover:bg-primary/10"
            >
              <IconArrowBack size={16} />
              بازگشت به تخصص‌ها
            </button>
            <span className="text-caption text-muted">
              {toPersianNumber(inSpecialty.length)} وکیل
            </span>
          </div>

          <TextField
            id="lawyer-selector-search"
            label="جست‌وجو در این تخصص"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<IconSearch size={18} />}
            fullWidth
          />

          {inSpecialty.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-large border border-divider/60 p-6 text-center">
              <IconInfo size={26} className="text-muted" />
              <p className="text-body-2 text-muted">وکیلی با این مشخصات در این تخصص یافت نشد.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inSpecialty.map((l) => (
                <LawyerRow
                  key={l.id}
                  lawyer={l}
                  current={l.id === currentLawyerId}
                  onPick={() => pick(l)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Level 3: confirm the replacement ---- */}
      {level === "confirm" && pending && (
        <div className="space-y-4">
          <div className="rounded-large border-2 border-control-selected-border bg-control-selected-surface p-4">
            <div className="flex items-start gap-3">
              <LawyerAvatar
                name={pending.fullName}
                avatarUrl={pending.avatarUrl}
                avatarType={pending.avatarType}
                size={52}
              />
              <div className="min-w-0 flex-1">
                <p className="text-labelLarge text-on-surface">{pending.fullName}</p>
                <p className="text-caption text-muted">
                  {pending.professionalTitle ?? "وکیل"}
                </p>
                <p className="mt-1 text-caption text-muted">
                  {pending.specializations
                    .map((s) => LEGAL_CATEGORY_FA[s.category] ?? s.category)
                    .join("، ")}
                </p>
              </div>
            </div>

            <dl className="mt-3 space-y-1.5 border-t border-control-selected-border/40 pt-3 text-caption">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">هزینه مشاوره</dt>
                <dd className="text-on-surface">
                  {formatToman(pending.pricing.consultationFeeToman)}
                </dd>
              </div>
              {pending.locations[0] && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">شهر</dt>
                  <dd className="text-on-surface">{pending.locations[0].city}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">وضعیت</dt>
                <dd>
                  <LawyerAvailabilityBadge
                    view={availabilityView(
                      pending.availabilityStatus,
                      pending.consultationCapacity,
                      pending.acceptingRequests
                    )}
                  />
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-caption text-muted">
            با تأیید، وکیل فعلی در پیش‌نویس مشاوره با این وکیل جایگزین می‌شود. تا پیش از تأیید،
            انتخاب فعلی شما تغییر نمی‌کند.
          </p>

          <div className="flex flex-col-reverse gap-2 mobile-l:flex-row mobile-l:justify-end">
            <Button
              variant="outlined"
              onClick={() => setLevel("list")}
              startIcon={<IconArrowBack size={18} />}
            >
              بازگشت
            </Button>
            <Button onClick={confirm} startIcon={<IconCheck size={18} />}>
              تأیید و انتخاب این وکیل
            </Button>
          </div>
        </div>
      )}

      {/* Cancel is always reachable, and never changes the draft. */}
      <div className="mt-4 flex justify-start border-t border-divider/60 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-caption text-muted transition hover:bg-surface-container hover:text-on-surface"
        >
          <IconClose size={16} />
          انصراف
        </button>
      </div>
    </Dialog>
  );
}
