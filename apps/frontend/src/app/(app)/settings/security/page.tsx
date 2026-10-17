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
import { Button } from "@legalir/ui";
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
    <div className="flex items-start gap-3 rounded-large border border-divider bg-surface-container p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
        <IconPerson size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-2 text-on-surface font-medium">
            {session.device} — {session.browser}
          </span>
          {session.current && (
            <span className="inline-flex items-center rounded-full bg-primary-container px-2 py-0.5 text-caption text-primary">
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
        <Button
          type="button"
          size="small"
          variant="danger-outlined"
          onClick={() => onRevoke(session.id)}
          disabled={revoking}
          startIcon={<IconDelete size={14} />}
          className="shrink-0"
        >
          خروج
        </Button>
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
              <div className="flex flex-wrap items-center gap-3 rounded-large border border-error bg-error-container p-4">
                <p className="text-body-2 text-error flex-1">
                  از {otherCount.toLocaleString("fa-IR")} نشست دیگر خارج می‌شوید. ادامه؟
                </p>
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => {
                    revokeOthers.mutate(undefined, {
                      onSettled: () => setConfirmOthers(false),
                    });
                  }}
                  loading={revokeOthers.isPending}
                >
                  تأیید
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  onClick={() => setConfirmOthers(false)}
                  disabled={revokeOthers.isPending}
                >
                  انصراف
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outlined"
                onClick={() => setConfirmOthers(true)}
                startIcon={<IconLogout size={16} />}
              >
                خروج از تمام نشست‌های دیگر
              </Button>
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
