// ============================================================
// LEGALIR — Settings · Sessions & Security (نشست‌ها و امنیت)
// ============================================================
// Real session data only: device, browser, IP and last-active come
// from the session records captured at login. No fabricated rows.
// ============================================================

"use client";

import { useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  SettingsCard,
  SkeletonBlock,
  ErrorBanner,
  EmptyState,
} from "@/components/settings/settings-ui";
import {
  useSessions,
  useRevokeSession,
  useRevokeOtherSessions,
} from "@/hooks/useAccount";
import { toPersianDate } from "@/lib/persian-utils";
import { IconShield, IconPerson, IconLogout, IconDelete } from "@/lib/icons";
import type { SessionInfo } from "@legalir/types";

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: SessionInfo;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-large border border-divider bg-surface-hover/40 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconPerson size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-2 text-on-surface font-medium">
            {session.device} — {session.browser}
          </span>
          {session.current && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-caption text-primary">
              جاری
            </span>
          )}
        </div>
        <p className="mt-1 text-caption text-muted">
          آخرین فعالیت: {toPersianDate(session.lastActiveAt)}
          {session.ip ? ` · ${session.ip}` : ""}
        </p>
      </div>
      {!session.current && (
        <button
          type="button"
          onClick={() => onRevoke(session.id)}
          disabled={revoking}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-error/30 px-3 py-1.5 text-caption text-error transition hover:bg-error/5 disabled:opacity-50"
        >
          <IconDelete size={14} />
          خروج
        </button>
      )}
    </div>
  );
}

export default function SecuritySettingsPage() {
  const query = useSessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [confirmOthers, setConfirmOthers] = useState(false);

  const sessions = query.data?.items ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <SettingsShell
      title="نشست‌ها و امنیت"
      description="دستگاه‌هایی که با حساب شما وارد شده‌اند را مدیریت کنید."
    >
      <SettingsCard title="نشست‌های فعال" icon={<IconShield size={22} />}>
        {query.isLoading ? (
          <SkeletonBlock lines={3} />
        ) : query.error ? (
          <ErrorBanner
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        ) : sessions.length === 0 ? (
          <EmptyState text="نشست فعالی یافت نشد." />
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onRevoke={(id) => revokeOne.mutate(id)}
                revoking={revokeOne.isPending}
              />
            ))}
          </div>
        )}

        {otherCount > 0 && (
          <div className="mt-4">
            {confirmOthers ? (
              <div className="flex flex-wrap items-center gap-3 rounded-large border border-error/30 bg-error/5 p-4">
                <p className="text-body-2 text-error flex-1">
                  از {otherCount.toLocaleString("fa-IR")} نشست دیگر خارج می‌شوید. ادامه؟
                </p>
                <button
                  type="button"
                  onClick={() => {
                    revokeOthers.mutate(undefined, {
                      onSettled: () => setConfirmOthers(false),
                    });
                  }}
                  disabled={revokeOthers.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-error px-4 py-2 text-body-2 text-on-error font-medium transition hover:bg-error/90 disabled:opacity-50"
                >
                  {revokeOthers.isPending ? "در حال خروج..." : "تأیید"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOthers(false)}
                  disabled={revokeOthers.isPending}
                  className="rounded-full border border-divider px-4 py-2 text-body-2 text-on-surface transition hover:bg-surface-hover"
                >
                  انصراف
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOthers(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-divider px-4 py-2 text-body-2 text-on-surface transition hover:bg-surface-hover"
              >
                <IconLogout size={16} />
                خروج از تمام نشست‌های دیگر
              </button>
            )}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="امنیت حساب" icon={<IconShield size={22} />}>
        <p className="text-body-2 text-muted leading-relaxed">
          ورود به لیگالیر با رمز یک‌بارمصرف پیامکی انجام می‌شود؛ بنابراین رمز
          عبوری برای تغییر وجود ندارد. برای حفظ امنیت، شماره موبایل حساب در
          پروفایل قابل تغییر نیست و هر ورود جدید به‌عنوان یک نشست جداگانه ثبت
          می‌شود.
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}
