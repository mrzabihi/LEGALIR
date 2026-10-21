// ============================================================
// LEGALIR — Admin · Feature-flag scope drawer
// ============================================================
// The allow-list editor for one feature flag. `isFlagEnabled` evaluates a
// limited/experiment flag in this order:
//
//   1. the caller's plan is in `allowedPlans`      → on
//   2. the caller's org is in `allowedOrgIds`      → on
//   3. otherwise the caller's bucket < rolloutPercent
//
// So the two lists are not documentation — they are the release decision for
// named plans and named organizations, ahead of the percentage. Until now the
// services table only RENDERED them; an operator could see `free, pro` in the
// «محدوده» cell and had no way to change it. This drawer closes that gap
// against the existing `PATCH /admin/flags/:key` contract.
//
// Both lists are submitted whole (never merged server-side), so clearing a
// chip genuinely removes that plan/org from the allow-list.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer, snackbar } from "@legalir/ui";
import { useUpdateAdminFlag } from "@/hooks/useAdmin";
import { FEATURE_FLAG_STATUS_FA, type FeatureFlag } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import { Button, Field, TextInput, InfoBanner, InlineNotice } from "@/components/admin/ui";

/** A frozen empty list so an unwrapped `?? EMPTY` keeps a stable identity. */
const EMPTY: string[] = [];

/** Split the free-text org input into de-duplicated ids. */
function parseIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,،]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((v) => set.has(v));
}

export function FlagScopeDrawer({
  flag,
  planOptions,
  open,
  onClose,
}: {
  flag: FeatureFlag | null;
  /** The real plan catalog — codes are what `isFlagEnabled` matches. */
  planOptions: { code: string; nameFa: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const updateFlag = useUpdateAdminFlag();

  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [orgsRaw, setOrgsRaw] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const flagKey = flag?.key ?? null;
  const flagUpdatedAt = flag?.updatedAt ?? null;
  const storedPlans = flag?.allowedPlans ?? EMPTY;
  const storedOrgs = flag?.allowedOrgIds ?? EMPTY;

  // Every time a different flag is opened, seed the draft from ITS stored
  // allow-lists. Keying on the flag identity avoids a stale draft leaking
  // across rows (or across an external save/refetch).
  useEffect(() => {
    if (!flagKey) return;
    setSelectedPlans(storedPlans);
    setOrgsRaw(storedOrgs.join(", "));
    setFeedback(null);
  }, [flagKey, flagUpdatedAt, storedPlans, storedOrgs]);

  const orgIds = useMemo(() => parseIds(orgsRaw), [orgsRaw]);

  const dirty = Boolean(
    flag && (!sameSet(selectedPlans, storedPlans) || !sameSet(orgIds, storedOrgs))
  );

  const listsHaveNoEffect = flag && flag.status !== "limited" && flag.status !== "experiment";

  function togglePlan(code: string) {
    setSelectedPlans((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function save() {
    if (!flag) return;
    setFeedback(null);
    try {
      await updateFlag.mutateAsync({
        key: flag.key,
        input: { allowedPlans: selectedPlans, allowedOrgIds: orgIds },
      });
      snackbar.show({ message: "محدودهٔ پرچم ویژگی به‌روزرسانی شد.", variant: "success" });
      onClose();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "به‌روزرسانی ناموفق بود";
      setFeedback(message);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} position="end" width={520} title="محدودهٔ انتشار">
      {flag && (
        <div className="space-y-4">
          <div>
            <h2 className="text-titleLarge text-on-surface">{flag.nameFa}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-muted">
              <span dir="ltr" className="font-mono">
                {flag.key}
              </span>
              <span aria-hidden="true">·</span>
              <span>وضعیت: {FEATURE_FLAG_STATUS_FA[flag.status]}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {toPersianNumber(flag.rolloutPercent)}٪ ترافیک
              </span>
            </div>
          </div>

          {listsHaveNoEffect && (
            <InfoBanner tone="info">
              این پرچم در وضعیت «{FEATURE_FLAG_STATUS_FA[flag.status]}» است؛ فهرست‌های مجاز فقط در
              وضعیت «محدود» یا «آزمایشی» ارزیابی می‌شوند. مقداردهی از پیش ممکن است، اما تا تغییر وضعیت
              اثری ندارد.
            </InfoBanner>
          )}

          {feedback && <InlineNotice tone="error">{feedback}</InlineNotice>}

          <Field
            label="پلن‌های مجاز"
            hint="کاربری که پلنش در این فهرست باشد پرچم را فعال می‌بیند — مستقل از درصد ترافیک. خالی‌گذاشتن یعنی هیچ پلنی از این مسیر مجاز نیست."
          >
            {planOptions.length === 0 ? (
              <p className="text-body-2 text-muted">
                کاتالوگ پلن‌ها در دسترس نیست؛ ابتدا پلنی در بخش پلن‌ها ثبت کنید.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="پلن‌های مجاز">
                {planOptions.map((p) => {
                  const active = selectedPlans.includes(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => togglePlan(p.code)}
                      className={`inline-flex h-10 max-desktop:min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-caption font-medium transition-colors duration-short3 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                        active
                          ? "border-primary bg-primary text-on-primary"
                          : "border-divider bg-surface text-muted hover:border-primary-300 hover:text-on-surface"
                      }`}
                    >
                      {p.nameFa}
                      <span dir="ltr" className="font-mono opacity-70">
                        {p.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <Field
            label="سازمان‌های مجاز"
            hint="شناسهٔ سازمان‌ها را با ویرگول یا فاصله جدا کنید. عضوِ این سازمان‌ها پرچم را فعال می‌بیند."
          >
            <TextInput
              dir="ltr"
              value={orgsRaw}
              onChange={(e) => setOrgsRaw(e.target.value)}
              placeholder="org_xxxxxxxx, org_yyyyyyyy"
            />
          </Field>

          {orgIds.length > 0 && (
            <div className="rounded-large border border-divider bg-surface p-3">
              <p className="mb-2 text-caption text-muted">
                {toPersianNumber(orgIds.length)} سازمان در فهرست:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {orgIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 font-mono text-caption text-on-surface-variant"
                    dir="ltr"
                  >
                    {id}
                    <button
                      type="button"
                      aria-label={`حذف ${id}`}
                      onClick={() => setOrgsRaw(orgIds.filter((x) => x !== id).join(", "))}
                      className="rounded-full px-1 text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-caption leading-relaxed text-muted">
            ترتیب ارزیابی: پلن مجاز ← سازمان مجاز ← درصد ترافیک. تغییر این فهرست‌ها با نام شما و مقدار
            قبل/بعد در گزارش رویدادها ثبت می‌شود.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              انصراف
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty || updateFlag.isPending}
              onClick={save}
            >
              {updateFlag.isPending ? "در حال ذخیره…" : "ذخیرهٔ محدوده"}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
